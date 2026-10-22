import { createRemoteJWKSet, jwtVerify, type JWTPayload, type JWTVerifyGetKey } from 'jose';
import { env } from './env.js';

/**
 * Neon Auth (Managed Better Auth) issues short-lived EdDSA JWTs. They are verified against the
 * project's public JWKS, so the API never needs a shared secret.
 */
let jwks: JWTVerifyGetKey | null = null;

export function getJwks(): JWTVerifyGetKey {
  if (!jwks) {
    const url = env.NEON_AUTH_JWKS_URL ?? `${env.NEON_AUTH_URL.replace(/\/$/, '')}/.well-known/jwks.json`;
    jwks = createRemoteJWKSet(new URL(url), { cooldownDuration: 30_000, cacheMaxAge: 10 * 60_000 });
  }
  return jwks;
}

/** Test hook: replace the key set (e.g. with a local JWKS). */
export function setJwksForTesting(keySet: JWTVerifyGetKey | null): void {
  jwks = keySet;
}

export interface NeonTokenClaims extends JWTPayload {
  sub: string;
  email?: string;
  name?: string;
  emailVerified?: boolean;
  image?: string | null;
}

export async function verifyNeonJwt(token: string): Promise<NeonTokenClaims> {
  const base = env.NEON_AUTH_URL.replace(/\/$/, '');
  const { payload } = await jwtVerify(token, getJwks(), {
    // Better Auth sets the issuer to the auth base URL; accept the bare origin as well.
    issuer: [base, new URL(base).origin],
    algorithms: ['EdDSA', 'ES256', 'RS256'],
    clockTolerance: 30,
  });
  if (!payload.sub) throw new Error('Token has no subject');
  return payload as NeonTokenClaims;
}
