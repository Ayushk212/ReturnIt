import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import request from 'supertest';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import mongoose from 'mongoose';
import { createApp } from '../src/app.js';
import { User } from '../src/models/User.js';
import { UserRole, UserStatus } from '@returnit/shared';

describe('Auth & User Security Tests', () => {
  let replSet: MongoMemoryReplSet;
  let app: ReturnType<typeof createApp>;

  beforeAll(async () => {
    process.env.NODE_ENV = 'test';
    process.env.JWT_ACCESS_SECRET = 'test_access_secret_which_is_at_least_32_characters_long!';
    process.env.JWT_REFRESH_SECRET = 'test_refresh_secret_which_is_at_least_32_characters_long!';
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

  it('registers a new user and issues access token and httpOnly cookie', async () => {
    const res = await request(app)
      .post('/api/auth/register')
      .send({
        name: 'Alice Owner',
        email: 'alice@example.com',
        password: 'Password1234!',
        phone: '+1234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.email).toBe('alice@example.com');
    expect(res.body.user.passwordHash).toBeUndefined();
    expect(res.body.user.phone).toBeUndefined(); // Phone not leaked in public payload
    expect(res.body.accessToken).toBeDefined();

    const cookies = res.headers['set-cookie'] as unknown as string[];
    expect(cookies).toBeDefined();
    expect(cookies.some((c: string) => c.includes('refreshToken=') && c.includes('HttpOnly'))).toBe(true);
  });

  it('rejects registration with duplicate email', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'Password1234!',
    });

    const res = await request(app).post('/api/auth/register').send({
      name: 'Alice Duplicate',
      email: 'alice@example.com',
      password: 'Password1234!',
    });

    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe('EMAIL_EXISTS');
  });

  it('provides identical response shape and message for wrong password and unknown email (enumeration parity)', async () => {
    await request(app).post('/api/auth/register').send({
      name: 'Alice',
      email: 'alice@example.com',
      password: 'Password1234!',
    });

    const wrongPasswordRes = await request(app).post('/api/auth/login').send({
      email: 'alice@example.com',
      password: 'WrongPassword!',
    });

    const unknownEmailRes = await request(app).post('/api/auth/login').send({
      email: 'unknown@example.com',
      password: 'Password1234!',
    });

    expect(wrongPasswordRes.status).toBe(401);
    expect(unknownEmailRes.status).toBe(401);
    expect(wrongPasswordRes.body.error.message).toBe('Invalid email or password');
    expect(unknownEmailRes.body.error.message).toBe('Invalid email or password');
    expect(wrongPasswordRes.body.error.code).toBe('INVALID_CREDENTIALS');
    expect(unknownEmailRes.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('rotates refresh token and detects reuse to revoke token family', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Bob Claimant',
      email: 'bob@example.com',
      password: 'Password1234!',
    });

    const cookies = regRes.headers['set-cookie'] as unknown as string[];
    const firstRefreshToken = cookies[0].split(';')[0].split('=')[1];

    // Legitimate rotation
    const refreshRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${firstRefreshToken}`]);

    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body.accessToken).toBeDefined();

    const newCookies = refreshRes.headers['set-cookie'] as unknown as string[];
    const secondRefreshToken = newCookies[0].split(';')[0].split('=')[1];
    expect(secondRefreshToken).not.toBe(firstRefreshToken);

    // REUSE ATTEMPT: Attacker attempts to replay the already-used firstRefreshToken
    const reuseRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${firstRefreshToken}`]);

    expect(reuseRes.status).toBe(401);
    expect(reuseRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');

    // Verification: Now the legitimate secondRefreshToken is also revoked because family was destroyed!
    const subsequentRes = await request(app)
      .post('/api/auth/refresh')
      .set('Cookie', [`refreshToken=${secondRefreshToken}`]);

    expect(subsequentRes.status).toBe(401);
    expect(subsequentRes.body.error.code).toBe('TOKEN_REUSE_DETECTED');
  });

  it('blocks suspended users from logging in and accessing endpoints', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Suspended User',
      email: 'suspended@example.com',
      password: 'Password1234!',
    });

    const token = regRes.body.accessToken;

    // Suspend user
    await User.updateOne({ email: 'suspended@example.com' }, { status: UserStatus.SUSPENDED });

    // Blocked on login
    const loginRes = await request(app).post('/api/auth/login').send({
      email: 'suspended@example.com',
      password: 'Password1234!',
    });

    expect(loginRes.status).toBe(403);
    expect(loginRes.body.error.code).toBe('ACCOUNT_SUSPENDED');

    // Blocked on authenticated endpoint
    const meRes = await request(app)
      .get('/api/users/me')
      .set('Authorization', `Bearer ${token}`);

    expect(meRes.status).toBe(403);
    expect(meRes.body.error.code).toBe('ACCOUNT_SUSPENDED');
  });

  it('prevents mass assignment of role, status, and trustScore on profile update', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Standard User',
      email: 'user@example.com',
      password: 'Password1234!',
    });

    const token = regRes.body.accessToken;

    const patchRes = await request(app)
      .patch('/api/users/me')
      .set('Authorization', `Bearer ${token}`)
      .send({
        name: 'Updated Name',
        role: UserRole.ADMIN,
        trustScore: 100,
        status: UserStatus.SUSPENDED,
      });

    expect(patchRes.status).toBe(200);
    expect(patchRes.body.user.name).toBe('Updated Name');
    expect(patchRes.body.user.role).toBe(UserRole.USER); // Still standard user
    expect(patchRes.body.user.trustScore).toBe(10); // Still 10

    const dbUser = await User.findOne({ email: 'user@example.com' });
    expect(dbUser?.role).toBe(UserRole.USER);
    expect(dbUser?.trustScore).toBe(10);
  });

  it('never leaks email, phone, or passwordHash on public user profile endpoint', async () => {
    const regRes = await request(app).post('/api/auth/register').send({
      name: 'Private Person',
      email: 'private@example.com',
      password: 'Password1234!',
      phone: '+1987654321',
      bio: 'Public community member',
    });

    const userId = regRes.body.user._id;

    const publicRes = await request(app).get(`/api/users/${userId}`);

    expect(publicRes.status).toBe(200);
    expect(publicRes.body.user.name).toBe('Private Person');
    expect(publicRes.body.user.bio).toBe('Public community member');
    expect(publicRes.body.user.email).toBeUndefined();
    expect(publicRes.body.user.phone).toBeUndefined();
    expect(publicRes.body.user.passwordHash).toBeUndefined();
  });
});
