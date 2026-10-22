import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import { generateKeyPair } from 'jose';
import { startHarness, type Harness } from './harness.js';

let h: Harness;
beforeAll(async () => {
  h = await startHarness();
});
afterAll(async () => {
  await h.close();
});

describe('Neon Auth token verification', () => {
  it('rejects requests without a token', async () => {
    const res = await request(h.app).get('/api/auth/me');
    expect(res.status).toBe(401);
  });

  it('rejects a malformed token', async () => {
    const res = await request(h.app).get('/api/auth/me').set('Authorization', 'Bearer not-a-jwt');
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('no longer accepts an email address as a token (former development bypass)', async () => {
    await h.createAuthUser({ email: 'victim@mnnit.ac.in' });
    for (const token of ['victim@mnnit.ac.in', 'dev-victim@mnnit.ac.in']) {
      const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it('accepts a valid token and creates the application user', async () => {
    const { id, token } = await h.createAuthUser({ email: 'Alice.Student@mnnit.ac.in', name: 'Alice Verma' });
    const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ id, email: 'alice.student@mnnit.ac.in', name: 'Alice Verma', onboarded: false });
  });

  it('accepts the bare origin as issuer too', async () => {
    const { id } = await h.createAuthUser({ email: 'origin@mnnit.ac.in' });
    const token = await h.signToken(id, { issuer: 'https://auth.example.test' });
    const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  it('rejects unverified email addresses', async () => {
    const { token } = await h.createAuthUser({ email: 'unverified@mnnit.ac.in', verified: false });
    const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe('EMAIL_UNVERIFIED');
  });

  it('rejects non-campus and look-alike domains', async () => {
    for (const email of ['someone@gmail.com', 'attacker@mnnit.ac.in.evil.com']) {
      const { token } = await h.createAuthUser({ email });
      const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe('FORBIDDEN_DOMAIN');
    }
  });

  it('rejects banned accounts', async () => {
    const { token } = await h.createAuthUser({ email: 'banned@mnnit.ac.in', banned: true });
    const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  it('rejects expired tokens, wrong issuers and foreign signing keys', async () => {
    const { id } = await h.createAuthUser({ email: 'bob@mnnit.ac.in' });
    const { privateKey: foreign } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
    const tokens = [
      await h.signToken(id, { expiresIn: '-1m' }),
      await h.signToken(id, { issuer: 'https://evil.example.com' }),
      await h.signToken(id, { key: foreign }),
    ];
    for (const token of tokens) {
      const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(401);
    }
  });

  it('rejects tokens for users that do not exist in Neon Auth', async () => {
    const token = await h.signToken('5b1d2c9e-7f0a-4c55-9d1e-2a3b4c5d6e7f');
    const res = await request(h.app).get('/api/auth/me').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
