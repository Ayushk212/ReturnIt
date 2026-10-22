import { Request, Response, NextFunction } from 'express';
import { query } from '../config/db.js';
import { verifyNeonJwt } from '../config/neonAuth.js';
import { AppError } from '../utils/AppError.js';
import { IUser, User } from '../models/User.js';
import { UserRole, UserStatus } from '@returnit/shared';

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export function isCampusEmail(email: string): boolean {
  if (!email || typeof email !== 'string') return false;
  return /^[^\s@]+@mnnit\.ac\.in$/.test(email.trim().toLowerCase());
}

interface AuthUserRow {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  email_verified: boolean;
  banned: boolean | null;
}

// Short cache so a burst of requests does not hit the database for every call.
const CACHE_MS = 30_000;
const cache = new Map<string, { user: IUser; at: number }>();

export function clearAuthCache(userId?: string): void {
  if (userId) cache.delete(userId);
  else cache.clear();
}

/**
 * Resolve a bearer token to an application user:
 * 1. verify the Neon Auth JWT signature, issuer and expiry;
 * 2. read the authoritative identity from `neon_auth.user` (fresh verification and ban status);
 * 3. enforce the campus domain and email verification;
 * 4. make sure a matching row exists in the application `users` table.
 */
export async function resolveUserFromToken(token: string): Promise<IUser> {
  let sub: string;
  try {
    sub = (await verifyNeonJwt(token)).sub;
  } catch {
    throw AppError.unauthorized('Your session has expired. Please sign in again.', 'TOKEN_INVALID');
  }

  const cached = cache.get(sub);
  if (cached && Date.now() - cached.at < CACHE_MS) return cached.user;

  const res = await query<AuthUserRow>(
    `SELECT id, email, name, image, "emailVerified" AS email_verified, banned
       FROM neon_auth.user WHERE id = $1`,
    [sub],
  );
  const identity = res.rows[0];
  if (!identity) throw AppError.unauthorized('Account not found. Please sign in again.', 'TOKEN_INVALID');
  if (identity.banned) throw AppError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');

  const email = (identity.email ?? '').trim().toLowerCase();
  if (!isCampusEmail(email)) {
    throw AppError.forbidden('Only @mnnit.ac.in campus email addresses are allowed', 'FORBIDDEN_DOMAIN');
  }
  if (!identity.email_verified) {
    throw AppError.forbidden('Please verify your email address first', 'EMAIL_UNVERIFIED');
  }

  let user = await User.findById(identity.id);
  if (!user || user.email !== email) {
    user = await User.upsertFromAuth({
      id: identity.id,
      email,
      name: identity.name || email.split('@')[0] || 'Member',
      avatarUrl: identity.image,
    });
  }
  if (user.status === UserStatus.SUSPENDED) {
    throw AppError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
  }

  cache.set(sub, { user, at: Date.now() });
  return user;
}

function bearer(req: Request): string | null {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  return header.slice(7).trim() || null;
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const token = bearer(req);
    if (!token) throw AppError.unauthorized('Authentication token is required');
    req.user = await resolveUserFromToken(token);
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const token = bearer(req);
  if (!token) return next();
  try {
    req.user = await resolveUserFromToken(token);
  } catch {
    // Anonymous access continues; protected routes use `authenticate`.
  }
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) return next(AppError.unauthorized());
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};
