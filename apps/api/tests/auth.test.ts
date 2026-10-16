import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { UserRole, UserStatus } from '@returnit/shared';

// Mock Firebase Admin Auth before importing app
vi.mock('../src/config/firebase.js', () => {
  return {
    getFirebaseAdmin: vi.fn(),
    getFirebaseAuth: () => ({
      verifyIdToken: vi.fn(async (token: string) => {
        if (token === 'expired_token') {
          const err = new Error('Token expired') as Error & { code: string };
          err.code = 'auth/id-token-expired';
          throw err;
        }
        if (token === 'revoked_token') {
          const err = new Error('Token revoked') as Error & { code: string };
          err.code = 'auth/id-token-revoked';
          throw err;
        }
        if (token === 'invalid_token') {
          const err = new Error('Token invalid') as Error & { code: string };
          err.code = 'auth/argument-error';
          throw err;
        }
        if (token === 'unverified_token') {
          return {
            uid: 'uid-unverified',
            email: 'unverified@mnnit.ac.in',
            email_verified: false,
            name: 'Unverified Student',
          };
        }
        if (token === 'non_campus_token') {
          return {
            uid: 'uid-non-campus',
            email: 'external@gmail.com',
            email_verified: true,
            name: 'External Person',
          };
        }
        if (token === 'lookalike_token') {
          return {
            uid: 'uid-lookalike',
            email: 'attacker@mnnit.ac.in.evil.com',
            email_verified: true,
            name: 'Attacker',
          };
        }
        if (token === 'subdomain_token') {
          return {
            uid: 'uid-subdomain',
            email: 'user@dept.mnnit.ac.in',
            email_verified: true,
            name: 'Subdomain User',
          };
        }
        if (token === 'suspended_token') {
          return {
            uid: 'uid-suspended',
            email: 'suspended@mnnit.ac.in',
            email_verified: true,
            name: 'Suspended Student',
          };
        }
        if (token.startsWith('valid_')) {
          const name = token.replace('valid_', '');
          return {
            uid: `uid-${name}`,
            email: `${name}@mnnit.ac.in`,
            email_verified: true,
            name: `${name.charAt(0).toUpperCase() + name.slice(1)} Student`,
          };
        }
        return {
          uid: 'uid-valid-default',
          email: 'default@mnnit.ac.in',
          email_verified: true,
          name: 'Default Student',
        };
      }),
    }),
  };
});

import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';

describe('Campus Firebase Auth & Access Control Tests', () => {
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

  it('allows valid token with @mnnit.ac.in campus email and verified status, auto-upserting user', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer valid_alice');

    expect(res.status).toBe(200);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('alice@mnnit.ac.in');
    expect(res.body.user.name).toBe('Alice Student');

    // Verify persisted in DB with firebaseUid
    const dbUser = await User.findOne({ email: 'alice@mnnit.ac.in' });
    expect(dbUser).not.toBeNull();
    expect(dbUser?.firebaseUid).toBe('uid-alice');
    expect(dbUser?.role).toBe(UserRole.USER);
    expect(dbUser?.status).toBe(UserStatus.ACTIVE);
  });

  it('rejects non-campus email (e.g. gmail.com) with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer non_campus_token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN_DOMAIN');

    // Verify user was NOT created in DB
    const dbUser = await User.findOne({ email: 'external@gmail.com' });
    expect(dbUser).toBeNull();
  });

  it('rejects unverified email with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer unverified_token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('EMAIL_UNVERIFIED');
  });

  it('rejects lookalike domain (e.g. mnnit.ac.in.evil.com) with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer lookalike_token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN_DOMAIN');
  });

  it('rejects subdomains (e.g. dept.mnnit.ac.in) with 403 Forbidden', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer subdomain_token');

    expect(res.status).toBe(403);
    expect(res.body.error).toBeDefined();
    expect(res.body.error.code).toBe('FORBIDDEN_DOMAIN');
  });

  it('rejects expired token with 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer expired_token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');
  });

  it('rejects revoked token with 401 Unauthorized', async () => {
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer revoked_token');

    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_REVOKED');
  });

  it('blocks suspended user from accessing endpoints with 403 Forbidden', async () => {
    // First let the user be created
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer suspended_token');

    // Suspend the user
    await User.updateOne({ firebaseUid: 'uid-suspended' }, { status: UserStatus.SUSPENDED });

    // Request again
    const res = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer suspended_token');

    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('prevents mass assignment of role, status, and trustScore on profile update', async () => {
    await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer valid_bob');

    const patchRes = await request(app)
      .patch('/api/users/me')
      .set('Authorization', 'Bearer valid_bob')
      .send({
        name: 'Bob Updated',
        role: UserRole.ADMIN,
        trustScore: 100,
        status: UserStatus.SUSPENDED,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.name).toBe('Bob Updated');
    expect(patchRes.body.user.role).toBe(UserRole.USER); // Still standard user
    expect(patchRes.body.user.trustScore).toBe(10); // Still 10

    const dbUser = await User.findOne({ email: 'bob@mnnit.ac.in' });
    expect(dbUser?.role).toBe(UserRole.USER);
    expect(dbUser?.trustScore).toBe(10);
  });

  it('never leaks email or phone on public user profile endpoint', async () => {
    const setupRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', 'Bearer valid_charlie');

    const userId = setupRes.body.user._id;

    const publicRes = await request(app).get(`/api/users/${userId}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.user.name).toBe('Charlie Student');
    expect(publicRes.body.user.email).toBeUndefined();
    expect(publicRes.body.user.phone).toBeUndefined();
  });
});
