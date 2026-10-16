import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { IUser, User } from '../models/User.js';
import { UserRole, UserStatus } from '@returnit/shared';

export interface TokenPayload {
  id: string;
  role: UserRole;
  status: UserStatus;
  email: string;
}

declare global {
  namespace Express {
    interface Request {
      user?: IUser;
    }
  }
}

export const authenticate = async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw AppError.unauthorized('Authentication token is required');
    }

    const token = authHeader.split(' ')[1];
    let decoded: TokenPayload;

    try {
      decoded = jwt.verify(token, env.JWT_ACCESS_SECRET) as TokenPayload;
    } catch (err) {
      if (err instanceof jwt.TokenExpiredError) {
        throw AppError.unauthorized('Authentication token has expired', 'TOKEN_EXPIRED');
      }
      throw AppError.unauthorized('Invalid authentication token', 'TOKEN_INVALID');
    }

    const user = await User.findById(decoded.id);
    if (!user) {
      throw AppError.unauthorized('User associated with this token no longer exists');
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
