import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { ItemCategory, ItemStatus } from '@returnit/shared';

// Mock Firebase Admin Auth before importing app
vi.mock('../src/config/firebase.js', () => {
  return {
    getFirebaseAdmin: vi.fn(),
    getFirebaseAuth: () => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token.startsWith('user_')) {
          const name = token.replace('user_', '');
          return {
            uid: `uid-${name}`,
            email: `${name}@mnnit.ac.in`,
            email_verified: true,
            name: `${name.charAt(0).toUpperCase() + name.slice(1)} Person`,
          };
        }
        return {
          uid: 'uid-default',
          email: 'default@mnnit.ac.in',
          email_verified: true,
          name: 'Default User',
        };
      }),
    }),
  };
});

import { createApp } from '../src/app.js';

describe('Items & Claims API Contract Tests', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.MONGODB_URI = 'mongodb://localhost:27017/test';

    replSet = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
    const uri = replSet.getUri();
    await mongoose.connect(uri);

    app = createApp();
  }, 60000);

  afterAll(async () => {
    await mongoose.disconnect();
    if (replSet) {
      await replSet.stop();
    }
  });

  beforeEach(async () => {
    const collections = mongoose.connection.collections;
    for (const key in collections) {
      await collections[key].deleteMany({});
    }
  });

  it('allows public GET /items and returns { items } matching web Item contract', async () => {
    // Create an item via API by user_alice
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', 'Bearer user_alice')
      .field('type', 'found')
      .field('title', 'Blue Water Bottle')
      .field('description', 'Found near Central Library reading hall')
      .field('category', ItemCategory.OTHER)
      .field('locationLabel', 'Central Library')
      .field('dateOccurred', new Date().toISOString())
      .field('verificationQuestion', 'What brand is it?')
      .field('verificationAnswer', 'Milton');

    expect(createRes.status).toBe(201);
    expect(createRes.body.id).toBeDefined();
    expect(createRes.body._id).toBeUndefined();
    expect(createRes.body.owner).toEqual({ name: 'Alice Person' });
    expect(createRes.body.owner.email).toBeUndefined();
    expect(createRes.body.isOwner).toBe(true);
    expect(createRes.body.saved).toBe(false);
    expect(createRes.body.locationLabel).toBe('Central Library');
    expect(createRes.body.verificationQuestion).toBe('What brand is it?');
    expect(createRes.body.verificationAnswer).toBeUndefined();
    expect(createRes.body.verificationAnswerHash).toBeUndefined();

    const itemId = createRes.body.id;

    // Public GET without auth token
    const publicRes = await request(app).get('/api/items');
    expect(publicRes.status).toBe(200);
    expect(Array.isArray(publicRes.body.items)).toBe(true);
    expect(publicRes.body.items.length).toBe(1);

    const publicItem = publicRes.body.items[0];
    expect(publicItem.id).toBe(itemId);
    expect(publicItem._id).toBeUndefined();
    expect(publicItem.owner).toEqual({ name: 'Alice Person' });
    expect(publicItem.isOwner).toBe(false);
    expect(publicItem.saved).toBe(false);
    expect(publicItem.verificationAnswer).toBeUndefined();
  });

  it('toggles saved status on POST /items/:id/save and filters with ?saved=true', async () => {
    // Alice creates item
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', 'Bearer user_alice')
      .field('type', 'lost')
      .field('title', 'Calculator Casio fx-991EX')
      .field('description', 'Lost in Computer Center Lab 2')
      .field('category', ItemCategory.ELECTRONICS)
      .field('locationLabel', 'Computer Science Dept.')
      .field('dateOccurred', new Date().toISOString());

    const itemId = createRes.body.id;

    // Bob saves Alice's item
    const saveRes1 = await request(app)
      .post(`/api/items/${itemId}/save`)
      .set('Authorization', 'Bearer user_bob');
    expect(saveRes1.status).toBe(200);
    expect(saveRes1.body.saved).toBe(true);

    // Bob checks list of saved items
    const savedListRes = await request(app)
      .get('/api/items?saved=true')
      .set('Authorization', 'Bearer user_bob');
    expect(savedListRes.status).toBe(200);
    expect(savedListRes.body.items.length).toBe(1);
    expect(savedListRes.body.items[0].id).toBe(itemId);
    expect(savedListRes.body.items[0].saved).toBe(true);
    expect(savedListRes.body.items[0].isOwner).toBe(false);

    // Bob un-saves
    const saveRes2 = await request(app)
      .post(`/api/items/${itemId}/save`)
      .set('Authorization', 'Bearer user_bob');
    expect(saveRes2.status).toBe(200);
    expect(saveRes2.body.saved).toBe(false);

    // List is now empty
    const savedListRes2 = await request(app)
      .get('/api/items?saved=true')
      .set('Authorization', 'Bearer user_bob');
    expect(savedListRes2.status).toBe(200);
    expect(savedListRes2.body.items.length).toBe(0);
  });

  it('handles claim workflow: submit claim, list claims, approve claim, reveal contacts', async () => {
    // Alice posts found keys
    const createRes = await request(app)
      .post('/api/items')
      .set('Authorization', 'Bearer user_alice')
      .field('type', 'found')
      .field('title', 'Motorcycle key with red keychain')
      .field('description', 'Found at Canteen table')
      .field('category', ItemCategory.KEYS)
      .field('locationLabel', 'Canteen / Mess')
      .field('dateOccurred', new Date().toISOString());

    const itemId = createRes.body.id;

    // Alice cannot claim her own item
    const ownClaimRes = await request(app)
      .post(`/api/items/${itemId}/claims`)
      .set('Authorization', 'Bearer user_alice')
      .send({ message: 'These are my own keys!' });
    expect(ownClaimRes.status).toBe(403);

    // Bob submits claim
    const claimRes = await request(app)
      .post(`/api/items/${itemId}/claims`)
      .set('Authorization', 'Bearer user_bob')
      .send({ message: 'I dropped my Hero Splendor key at the canteen around 1 PM' });

    expect(claimRes.status).toBe(201);
    expect(claimRes.body.id).toBeDefined();
    expect(claimRes.body.itemId).toBe(itemId);
    expect(claimRes.body.direction).toBe('sent');
    expect(claimRes.body.counterpartName).toBe('Alice Person');
    expect(claimRes.body.status).toBe('pending');
    expect(claimRes.body.contact).toBeUndefined(); // Not revealed before approval

    const claimId = claimRes.body.id;

    // Alice views incoming claims
    const aliceClaimsRes = await request(app)
      .get('/api/claims')
      .set('Authorization', 'Bearer user_alice');

    expect(aliceClaimsRes.status).toBe(200);
    expect(aliceClaimsRes.body.claims.length).toBe(1);
    const incomingClaim = aliceClaimsRes.body.claims[0];
    expect(incomingClaim.id).toBe(claimId);
    expect(incomingClaim.direction).toBe('received');
    expect(incomingClaim.counterpartName).toBe('Bob Person');
    expect(incomingClaim.message).toContain('Hero Splendor key');
    expect(incomingClaim.status).toBe('pending');
    expect(incomingClaim.contact).toBeUndefined();

    // Alice approves Bob's claim
    const approveRes = await request(app)
      .post(`/api/claims/${claimId}/approve`)
      .set('Authorization', 'Bearer user_alice');

    expect(approveRes.status).toBe(200);
    expect(approveRes.body.status).toBe('approved');
    // Once approved, contact is revealed to the listing owner
    expect(approveRes.body.contact).toBeDefined();
    expect(approveRes.body.contact?.name).toBe('Bob Person');
    expect(approveRes.body.contact?.email).toBe('bob@mnnit.ac.in');

    // Item status is now resolved
    const itemRes = await request(app).get(`/api/items/${itemId}`);
    expect(itemRes.status).toBe(200);
    expect(itemRes.body.status).toBe(ItemStatus.RESOLVED);
  });
});
