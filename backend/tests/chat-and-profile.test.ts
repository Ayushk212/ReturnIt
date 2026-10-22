import crypto from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import request from 'supertest';
import sharp from 'sharp';
import { samplePng, startHarness, type Harness } from './harness.js';

let h: Harness;
type U = { id: string; token: string };
let finder: U;
let seeker: U;
let outsider: U;
let itemId: string;
const auth = (u: U) => ({ Authorization: `Bearer ${u.token}` });

beforeAll(async () => {
  h = await startHarness();
  finder = await h.createAuthUser({ email: 'finder@mnnit.ac.in', name: 'Riya Finder' });
  seeker = await h.createAuthUser({ email: 'seeker@mnnit.ac.in', name: 'Aman Seeker' });
  outsider = await h.createAuthUser({ email: 'outsider@mnnit.ac.in' });
  for (const u of [finder, seeker, outsider]) await request(h.app).get('/api/auth/me').set(auth(u));
  const res = await request(h.app)
    .post('/api/items')
    .set(auth(finder))
    .field('type', 'found')
    .field('title', 'Casio scientific calculator')
    .field('description', 'Found under a bench in the lecture hall complex.')
    .field('category', 'electronics')
    .field('locationLabel', 'Lecture Hall Complex')
    .field('verificationQuestion', 'What is scratched on the back?')
    .field('verificationAnswer', 'AK');
  itemId = res.body.id;
});
afterAll(async () => {
  await h.close();
});

describe('Direct messages', () => {
  let conversationId: string;

  it('lets a member message the person who posted a listing', async () => {
    const res = await request(h.app).post('/api/conversations').set(auth(seeker)).send({ itemId });
    expect(res.status).toBe(201);
    conversationId = res.body.conversation.id;
    expect(res.body.conversation.counterpart).toMatchObject({ id: finder.id, name: 'Riya Finder' });
    expect(JSON.stringify(res.body)).not.toContain('@mnnit.ac.in');

    const again = await request(h.app).post('/api/conversations').set(auth(seeker)).send({ itemId });
    expect(again.body.conversation.id).toBe(conversationId);
  });

  it('only lets the owner start conversations with people who sent a request', async () => {
    const missing = await request(h.app).post('/api/conversations').set(auth(finder)).send({ itemId });
    expect(missing.status).toBe(400);
    const notClaimant = await request(h.app).post('/api/conversations').set(auth(finder)).send({ itemId, participantId: outsider.id });
    expect(notClaimant.status).toBe(403);
  });

  it('stores messages, deduplicates retries and tracks unread counts', async () => {
    const clientMessageId = crypto.randomUUID();
    const send = () =>
      request(h.app).post(`/api/conversations/${conversationId}/messages`).set(auth(seeker)).send({ content: '  Hi, I think this is mine.  ', clientMessageId });
    const first = await send();
    const retry = await send();
    expect(first.status).toBe(201);
    expect(retry.status).toBe(200);
    expect(retry.body.message.id).toBe(first.body.message.id);
    expect(first.body.message).toMatchObject({ content: 'Hi, I think this is mine.', fromMe: true, read: false });

    const summary = await request(h.app).get('/api/users/me/summary').set(auth(finder));
    expect(summary.body.unreadMessages).toBe(1);

    const inbox = await request(h.app).get('/api/conversations').set(auth(finder));
    expect(inbox.body.conversations[0]).toMatchObject({ unreadCount: 1, lastMessage: { content: 'Hi, I think this is mine.', fromMe: false } });

    await request(h.app).post(`/api/conversations/${conversationId}/read`).set(auth(finder));
    expect((await request(h.app).get('/api/users/me/summary').set(auth(finder))).body.unreadMessages).toBe(0);

    const thread = await request(h.app).get(`/api/conversations/${conversationId}/messages`).set(auth(seeker));
    expect(thread.body.messages).toHaveLength(1);
    expect(thread.body.messages[0].read).toBe(true);
  });

  it('keeps messages in order and validates content', async () => {
    for (const text of ['Second', 'Third']) {
      await request(h.app).post(`/api/conversations/${conversationId}/messages`).set(auth(finder)).send({ content: text, clientMessageId: crypto.randomUUID() });
    }
    const thread = await request(h.app).get(`/api/conversations/${conversationId}/messages`).set(auth(finder));
    expect(thread.body.messages.map((m: { content: string }) => m.content)).toEqual(['Hi, I think this is mine.', 'Second', 'Third']);
    const empty = await request(h.app).post(`/api/conversations/${conversationId}/messages`).set(auth(finder)).send({ content: '   ', clientMessageId: crypto.randomUUID() });
    expect(empty.status).toBe(400);
  });

  it('hides conversations from people who are not in them', async () => {
    expect((await request(h.app).get(`/api/conversations/${conversationId}`).set(auth(outsider))).status).toBe(404);
    expect((await request(h.app).get(`/api/conversations/${conversationId}/messages`).set(auth(outsider))).status).toBe(404);
    const post = await request(h.app).post(`/api/conversations/${conversationId}/messages`).set(auth(outsider)).send({ content: 'hello', clientMessageId: crypto.randomUUID() });
    expect(post.status).toBe(404);
    expect((await request(h.app).get('/api/conversations')).status).toBe(401);
  });
});

describe('Profiles', () => {
  it('completes onboarding and writes a presentable bio', async () => {
    const res = await request(h.app).post('/api/users/me/onboarding').set(auth(seeker)).send({
      name: 'Aman Kumar',
      programme: 'B.Tech',
      academicYear: '3rd year',
      branch: 'Computer Science and Engineering',
      section: 'b',
      about: 'Usually around the library in the evenings.',
    });
    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({
      name: 'Aman Kumar',
      onboarded: true,
      bio: '3rd-year B.Tech student in Computer Science and Engineering, Section B. Usually around the library in the evenings.',
      academic: { section: 'B', summary: 'B.Tech · 3rd year · Computer Science and Engineering · Section B' },
    });
  });

  it('rejects values outside the allowed lists', async () => {
    const res = await request(h.app).post('/api/users/me/onboarding').set(auth(outsider)).send({
      name: 'X Y', programme: 'Wizardry', academicYear: '3rd year', branch: 'Civil Engineering',
    });
    expect(res.status).toBe(400);
  });

  it('shows a public profile without private contact details', async () => {
    const res = await request(h.app).get(`/api/users/${seeker.id}`);
    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('Aman Kumar');
    expect(JSON.stringify(res.body)).not.toContain('seeker@mnnit.ac.in');
    const listings = await request(h.app).get(`/api/users/${finder.id}/listings`);
    expect(listings.body.items).toHaveLength(1);
  });

  it('compresses uploaded profile photos to a 320px WebP', async () => {
    const res = await request(h.app)
      .post('/api/users/me/avatar')
      .set(auth(seeker))
      .attach('avatar', await samplePng(2400, 1600), { filename: 'me.png', contentType: 'image/png' });
    expect(res.status).toBe(200);
    expect(res.body.user.hasUploadedAvatar).toBe(true);
    const path = new URL(res.body.user.avatarUrl).pathname + new URL(res.body.user.avatarUrl).search;
    const img = await request(h.app).get(path).buffer(true).parse((r, cb) => {
      const chunks: Buffer[] = [];
      r.on('data', (c: Buffer) => chunks.push(c));
      r.on('end', () => cb(null, Buffer.concat(chunks)));
    });
    const meta = await sharp(img.body as Buffer).metadata();
    expect([meta.format, meta.width, meta.height]).toEqual(['webp', 320, 320]);

    const removed = await request(h.app).delete('/api/users/me/avatar').set(auth(seeker));
    expect(removed.body.user.hasUploadedAvatar).toBe(false);
  });

  it('reports listing history counts for the signed-in user', async () => {
    const me = await request(h.app).get('/api/users/me').set(auth(finder));
    expect(me.body.user.stats).toEqual({ lost: 0, found: 1, resolved: 0, active: 1 });
  });
});
