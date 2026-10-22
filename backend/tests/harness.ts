import crypto from 'node:crypto';
import type { Express } from 'express';
import pg from 'pg';
import { PGlite } from '@electric-sql/pglite';
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto';
import { PGLiteSocketServer } from '@electric-sql/pglite-socket';
import { SignJWT, createLocalJWKSet, exportJWK, generateKeyPair, type CryptoKey } from 'jose';

/**
 * Integration harness: an in-process PostgreSQL (PGlite) exposed over the real wire protocol,
 * so the app's `pg` pool, SQL and transactions run unmodified. Neon Auth is simulated with a
 * `neon_auth.user` table and a locally generated Ed25519 signing key.
 */
export const AUTH_URL = 'https://auth.example.test/neondb/auth';

export interface Harness {
  app: Express;
  signToken: (sub: string, opts?: { expiresIn?: string; key?: CryptoKey; issuer?: string }) => Promise<string>;
  createAuthUser: (opts: { email: string; name?: string; verified?: boolean; banned?: boolean }) => Promise<{ id: string; token: string }>;
  close: () => Promise<void>;
}

export async function startHarness(): Promise<Harness> {
  const pglite = await PGlite.create({ extensions: { pgcrypto } });
  const port = 54000 + Math.floor(Math.random() * 5000);
  const server = new PGLiteSocketServer({ db: pglite, port, host: '127.0.0.1' });
  await server.start();

  process.env.NODE_ENV = 'test';
  process.env.DB_POOL_MAX = '1'; // PGlite is a single session; one connection keeps transactions isolated
  process.env.DATABASE_URL = `postgres://postgres@127.0.0.1:${port}/postgres?sslmode=disable`;
  process.env.NEON_AUTH_URL = AUTH_URL;

  const db = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await db.connect();
  await db.query(`
    CREATE SCHEMA IF NOT EXISTS neon_auth;
    CREATE TABLE IF NOT EXISTS neon_auth."user" (
      id UUID PRIMARY KEY, name TEXT, email TEXT NOT NULL, "emailVerified" BOOLEAN NOT NULL DEFAULT FALSE,
      image TEXT, banned BOOLEAN DEFAULT FALSE
    );
  `);
  // Run migrations through a separate connection and release it, so the app's single pool slot is free.
  const { runMigrations } = await import('../src/config/migrate.js');
  await runMigrations(db);
  await db.end();

  const { publicKey, privateKey } = await generateKeyPair('EdDSA', { crv: 'Ed25519' });
  const jwk = { ...(await exportJWK(publicKey)), kid: 'test-key', alg: 'EdDSA' };
  const { setJwksForTesting } = await import('../src/config/neonAuth.js');
  setJwksForTesting(createLocalJWKSet({ keys: [jwk] }));

  const { createApp } = await import('../src/app.js');
  const app = createApp();

  const signToken: Harness['signToken'] = (sub, opts = {}) =>
    new SignJWT({ sub })
      .setProtectedHeader({ alg: 'EdDSA', kid: 'test-key' })
      .setSubject(sub)
      .setIssuer(opts.issuer ?? AUTH_URL)
      .setIssuedAt()
      .setExpirationTime(opts.expiresIn ?? '15m')
      .sign(opts.key ?? privateKey);

  const { getPool } = await import('../src/config/db.js');
  const createAuthUser: Harness['createAuthUser'] = async ({ email, name, verified = true, banned = false }) => {
    const id = crypto.randomUUID();
    await getPool().query(
      `INSERT INTO neon_auth."user" (id, name, email, "emailVerified", banned) VALUES ($1, $2, $3, $4, $5)`,
      [id, name ?? email.split('@')[0], email, verified, banned],
    );
    return { id, token: await signToken(id) };
  };

  return {
    app,
    signToken,
    createAuthUser,
    close: async () => {
      const { disconnectDatabase } = await import('../src/config/db.js');
      await disconnectDatabase();
      await server.stop();
      await pglite.close();
    },
  };
}

/** A small real PNG for upload tests. */
export async function samplePng(width = 1200, height = 900): Promise<Buffer> {
  const sharp = (await import('sharp')).default;
  return sharp({ create: { width, height, channels: 3, background: { r: 47, g: 69, b: 255 } } })
    .png()
    .toBuffer();
}
