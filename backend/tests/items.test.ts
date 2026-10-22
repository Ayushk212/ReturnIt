import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { samplePng, startHarness, type Harness } from './harness.js';

let h: Harness;
let finder: { id: string; token: string };
let owner: { id: string; token: string };
let stranger: { id: string; token: string };

const auth = (t: { token: string }) => ({ Authorization: `Bearer ${t.token}` });

function postItem(user: { token: string }, fields: Record<string, string>, photos: Buffer[] = [], key?: string) {
  const req = request(h.app).post('/api/items').set(auth(user));
  if (key) req.set('Idempotency-Key', key);
  for (const [k, v] of Object.entries(fields)) req.field(k, v);
  photos.forEach((p, i) => req.attach('images', p, { filename: `photo-${i}.png`, contentType: 'image/png' }));
  return req;
}

const FOUND_WALLET = {
  type: 'found',
  title: 'Black leather wallet',
  description: 'Plain black wallet found on a reading table near the window.',
  category: 'wallets-bags',
  locationLabel: 'Central Library',
  dateOccurred: new Date(Date.now() - 3600_000).toISOString(),
  verificationQuestion: 'Which department is printed on the ID card?',
  verificationAnswer: 'Civil',
};

beforeAll(async () => {
  h = await startHarness();
  finder = await h.createAuthUser({ email: 'finder@mnnit.ac.in', name: 'Riya Finder' });
  owner = await h.createAuthUser({ email: 'owner@mnnit.ac.in', name: 'Aman Owner' });
  stranger = await h.createAuthUser({ email: 'stranger@mnnit.ac.in' });
  // First authenticated call creates each application user.
  for (const u of [finder, owner, stranger]) await request(h.app).get('/api/auth/me').set(auth(u));
});
afterAll(async () => {
  await h.close();
});

describe('Listings and photos', () => {
  let itemId: string;

  it('creates a listing and compresses photos to WebP', async () => {
    const original = await samplePng(3000, 2000);
    const res = await postItem(finder, FOUND_WALLET, [original]);
    expect(res.status).toBe(201);
    itemId = res.body.id;
    expect(res.body.images).toHaveLength(1);
    expect(res.body.images[0]).toMatchObject({ width: 1600, height: 1067 });
    expect(JSON.stringify(res.body)).not.toContain('data:image');
    expect(res.body).not.toHaveProperty('verificationAnswer');
    expect(JSON.stringify(res.body)).not.toContain('Civil');

    const full = await request(h.app).get(`/api/items/${itemId}/photos/0`).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    expect(full.status).toBe(200);
    expect(full.headers['content-type']).toBe('image/webp');
    expect(full.headers['cross-origin-resource-policy']).toBe('cross-origin');
    const meta = await sharp(full.body as Buffer).metadata();
    expect(meta.format).toBe('webp');
    expect(meta.width).toBe(1600);

    const thumb = await request(h.app).get(`/api/items/${itemId}/photos/0?size=thumb`);
    expect(thumb.status).toBe(200);
    expect(Number(thumb.headers['content-length'])).toBeLessThan(Number(full.headers['content-length']));
  });

  it('rejects files that are not real images', async () => {
    const res = await postItem(finder, FOUND_WALLET, [Buffer.from('definitely not a png')]);
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe('INVALID_IMAGE');
  });

  it('shows other members’ listings on the board when signed in (regression)', async () => {
    const asOwner = await request(h.app).get('/api/items').set(auth(owner));
    expect(asOwner.body.items.map((i: { id: string }) => i.id)).toContain(itemId);
    const anonymous = await request(h.app).get('/api/items');
    expect(anonymous.body.items.map((i: { id: string }) => i.id)).toContain(itemId);
    const mine = await request(h.app).get('/api/items?mine=true').set(auth(owner));
    expect(mine.body.items).toHaveLength(0);
  });

  it('filters by type, category and keyword', async () => {
    const byType = await request(h.app).get('/api/items?type=lost');
    expect(byType.body.items).toHaveLength(0);
    const byQuery = await request(h.app).get('/api/items?q=leather&category=wallets-bags');
    expect(byQuery.body.items).toHaveLength(1);
    const wildcard = await request(h.app).get('/api/items?q=%25');
    expect(wildcard.body.items).toHaveLength(0);
  });

  it('returns 404 for malformed and unknown ids instead of a server error', async () => {
    expect((await request(h.app).get('/api/items/not-a-uuid')).status).toBe(404);
    expect((await request(h.app).get('/api/items/5b1d2c9e-7f0a-4c55-9d1e-2a3b4c5d6e7f')).status).toBe(404);
    expect((await request(h.app).get('/api/users/123')).status).toBe(404);
  });

  it('deduplicates retried submissions with the same idempotency key', async () => {
    const a = await postItem(owner, { ...FOUND_WALLET, type: 'lost', title: 'Grey laptop charger' }, [], 'key-1');
    const b = await postItem(owner, { ...FOUND_WALLET, type: 'lost', title: 'Grey laptop charger' }, [], 'key-1');
    expect(a.status).toBe(201);
    expect(b.status).toBe(200);
    expect(b.body.id).toBe(a.body.id);
  });

  it('suggests matches of the opposite type in the same category', async () => {
    const lost = await postItem(owner, { ...FOUND_WALLET, type: 'lost', title: 'Lost black wallet', description: 'Black wallet with my ID card inside it.' });
    const res = await request(h.app).get(`/api/items/${lost.body.id}/matches`);
    expect(res.status).toBe(200);
    expect(res.body.items[0].id).toBe(itemId);
  });

  it('runs the request, approval and contact reveal flow', async () => {
    const claim = await request(h.app).post(`/api/items/${itemId}/claims`).set(auth(owner)).send({ message: 'It says Civil Engineering on the card.' });
    expect(claim.status).toBe(201);
    expect(claim.body.contact).toBeUndefined();
    expect((await request(h.app).get(`/api/items/${itemId}`)).body.status).toBe('claim_pending');

    const dup = await request(h.app).post(`/api/items/${itemId}/claims`).set(auth(owner)).send({ message: 'Sending this a second time.' });
    expect(dup.status).toBe(409);

    const forbidden = await request(h.app).post(`/api/claims/${claim.body.id}/approve`).set(auth(stranger));
    expect(forbidden.status).toBe(403);

    const approved = await request(h.app).post(`/api/claims/${claim.body.id}/approve`).set(auth(finder));
    expect(approved.status).toBe(200);
    expect(approved.body.contact).toEqual({ name: 'Aman Owner', email: 'owner@mnnit.ac.in' });

    const again = await request(h.app).post(`/api/claims/${claim.body.id}/approve`).set(auth(finder));
    expect(again.status).toBe(409);
    expect((await request(h.app).get(`/api/items/${itemId}`)).body.status).toBe('resolved');

    const sent = await request(h.app).get('/api/claims').set(auth(owner));
    expect(sent.body.claims[0]).toMatchObject({ direction: 'sent', status: 'approved', counterpartId: finder.id });
  });

  it('accepts one report per member per listing', async () => {
    const body = { reason: 'spam', details: 'This listing looks like an advertisement.' };
    const first = await request(h.app).post(`/api/items/${itemId}/report`).set(auth(stranger)).send(body);
    const second = await request(h.app).post(`/api/items/${itemId}/report`).set(auth(stranger)).send(body);
    expect(first.status).toBe(201);
    expect(second.body.alreadyReported).toBe(true);
  });

  it('toggles bookmarks', async () => {
    const on = await request(h.app).post(`/api/items/${itemId}/save`).set(auth(stranger));
    expect(on.body.saved).toBe(true);
    const saved = await request(h.app).get('/api/items?saved=true').set(auth(stranger));
    expect(saved.body.items[0].saved).toBe(true);
    const off = await request(h.app).post(`/api/items/${itemId}/save`).set(auth(stranger));
    expect(off.body.saved).toBe(false);
  });
});
