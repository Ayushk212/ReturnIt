import { Request, Response, NextFunction } from 'express';
import type { DecodedIdToken } from 'firebase-admin/auth';
import { getFirebaseAuth } from '../config/firebase.js';
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

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = authHeader.slice(7).trim();
    if (!token) {
      throw AppError.unauthorized('Authentication token is required');
    }

    let decoded: DecodedIdToken;
    try {
      decoded = await getFirebaseAuth().verifyIdToken(token, true);
    } catch (err: unknown) {
      const code = typeof err === 'object' && err !== null && 'code' in err ? String((err as { code: unknown }).code) : '';
      if (code === 'auth/id-token-expired') {
        throw AppError.unauthorized('Authentication token has expired', 'TOKEN_EXPIRED');
      }
      if (code === 'auth/id-token-revoked') {
        throw AppError.unauthorized('Authentication token has been revoked', 'TOKEN_REVOKED');
      }
      throw AppError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
    }

    if (!decoded.email_verified) {
      throw AppError.forbidden('Please verify your email address first', 'EMAIL_UNVERIFIED');
    }

    const email = (decoded.email ?? '').trim().toLowerCase();
    if (!isCampusEmail(email)) {
      throw AppError.forbidden('Only @mnnit.ac.in campus email addresses are allowed', 'FORBIDDEN_DOMAIN');
    }

    // Upsert user by firebaseUid
    let user = await User.findOne({ firebaseUid: decoded.uid });
    if (!user) {
      user = await User.findOne({ email });
      if (user) {
        user.firebaseUid = decoded.uid;
        if (decoded.name && (!user.name || user.name === 'Member')) {
          user.name = decoded.name;
        }
        await user.save();
      } else {
        user = await User.create({
          firebaseUid: decoded.uid,
          email,
          name: decoded.name || email.split('@')[0] || 'Member',
          avatarUrl: decoded.picture,
          role: UserRole.USER,
          status: UserStatus.ACTIVE,
          trustScore: 10,
          savedItems: [],
        });
      }
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw AppError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    req.user = user;
    next();
  } catch (err) {
    next(err);
  }
};

export const optionalAuthenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return next();
  }

  const token = authHeader.slice(7).trim();
  if (!token) {
    return next();
  }

  try {
    const decoded = await getFirebaseAuth().verifyIdToken(token, true);
    if (!decoded.email_verified) return next();

    const email = (decoded.email ?? '').trim().toLowerCase();
    if (!isCampusEmail(email)) return next();

    const user = await User.findOne({ firebaseUid: decoded.uid });
    if (user && user.status !== UserStatus.SUSPENDED) {
      req.user = user;
    }
  } catch {
    // Silently continue for optional authentication
  }
  next();
};

export const requireRole = (...roles: UserRole[]) => {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(AppError.unauthorized());
    }
    if (!roles.includes(req.user.role)) {
      return next(AppError.forbidden('You do not have permission to perform this action'));
    }
    next();
  };
};
