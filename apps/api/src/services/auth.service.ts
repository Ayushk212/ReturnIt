import crypto from 'node:crypto';
import argon2 from 'argon2';
import jwt, { SignOptions } from 'jsonwebtoken';
import { Types } from 'mongoose';
import { env } from '../config/env.js';
import { AppError } from '../utils/AppError.js';
import { IUser, User } from '../models/User.js';
import { RefreshToken } from '../models/RefreshToken.js';
import {
  ChangePasswordInput,
  LoginInput,
  RegisterInput,
  UserRole,
  UserStatus,
} from '@returnit/shared';

// Pre-computed dummy argon2 hash for constant-time comparison on unknown email
const DUMMY_HASH =
  '$argon2id$v=19$m=65536,t=3,p=4$c29tZXNhbHQxMjM0NTY3OA$9f3Gq3uJ5eB1o+6rTq7kG2b7aNqG3K1f5o1P8vQ6z8c';

const hashToken = (token: string): string => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
}

export class AuthService {
  private static generateTokens(user: IUser, familyId?: string): TokenPair & { familyId: string } {
    const payload = {
      id: user._id.toString(),
      email: user.email,
      role: user.role,
      status: user.status,
    };

    const accessTokenOptions: SignOptions = {
      expiresIn: env.JWT_ACCESS_EXPIRY as SignOptions['expiresIn'],
      jwtid: crypto.randomUUID(),
    };

    const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, accessTokenOptions);

    const currentFamilyId = familyId || crypto.randomUUID();
    const refreshPayload = {
      id: user._id.toString(),
      familyId: currentFamilyId,
    };

    const refreshTokenOptions: SignOptions = {
      expiresIn: `${env.JWT_REFRESH_EXPIRY_DAYS}d` as SignOptions['expiresIn'],
      jwtid: crypto.randomUUID(),
    };

    const refreshToken = jwt.sign(refreshPayload, env.JWT_REFRESH_SECRET, refreshTokenOptions);

    return { accessToken, refreshToken, familyId: currentFamilyId };
  }

  static async register(input: RegisterInput): Promise<{ user: Partial<IUser>; tokens: TokenPair }> {
    const existing = await User.findOne({ email: input.email });
    if (existing) {
      throw AppError.conflict('An account with this email already exists', 'EMAIL_EXISTS');
    }

    const passwordHash = await argon2.hash(input.password, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });

    const user = await User.create({
      name: input.name,
      email: input.email,
      passwordHash,
      phone: input.phone,
      bio: input.bio || '',
      role: UserRole.USER,
      status: UserStatus.ACTIVE,
      trustScore: 10,
    });

    const { accessToken, refreshToken, familyId } = this.generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        role: user.role,
        status: user.status,
        trustScore: user.trustScore,
        createdAt: user.createdAt,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  static async login(input: LoginInput): Promise<{ user: Partial<IUser>; tokens: TokenPair }> {
    const user = await User.findOne({ email: input.email }).select('+passwordHash');

    if (!user) {
      // Execute dummy verify for timing parity
      await argon2.verify(DUMMY_HASH, input.password).catch(() => false);
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    if (user.status === UserStatus.SUSPENDED) {
      throw AppError.forbidden('Your account has been suspended', 'ACCOUNT_SUSPENDED');
    }

    const isMatch = await argon2.verify(user.passwordHash, input.password);
    if (!isMatch) {
      throw AppError.unauthorized('Invalid email or password', 'INVALID_CREDENTIALS');
    }

    const { accessToken, refreshToken, familyId } = this.generateTokens(user);

    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);

    await RefreshToken.create({
      userId: user._id,
      tokenHash: hashToken(refreshToken),
      familyId,
      expiresAt,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        bio: user.bio,
        avatarUrl: user.avatarUrl,
        role: user.role,
        status: user.status,
        trustScore: user.trustScore,
        createdAt: user.createdAt,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  static async refresh(token: string): Promise<{ user: Partial<IUser>; tokens: TokenPair }> {
    if (!token) {
      throw AppError.unauthorized('Refresh token is required');
    }

    let decoded: { id: string; familyId: string };
    try {
      decoded = jwt.verify(token, env.JWT_REFRESH_SECRET) as { id: string; familyId: string };
    } catch {
      throw AppError.unauthorized('Invalid or expired refresh token', 'TOKEN_INVALID');
    }

    const tokenH = hashToken(token);
    const existingToken = await RefreshToken.findOne({ tokenHash: tokenH });

    // REUSE DETECTION: Token is unknown or already revoked
    if (!existingToken || existingToken.revokedAt) {
      // Revoke the entire family
      await RefreshToken.updateMany(
        { familyId: decoded.familyId },
        { revokedAt: new Date() },
      );
      throw AppError.unauthorized(
        'Refresh token reuse detected. All sessions in this family have been revoked.',
        'TOKEN_REUSE_DETECTED',
      );
    }

    if (existingToken.expiresAt < new Date()) {
      throw AppError.unauthorized('Refresh token expired', 'TOKEN_EXPIRED');
    }

    const user = await User.findById(decoded.id);
    if (!user || user.status === UserStatus.SUSPENDED) {
      throw AppError.forbidden('User not found or suspended', 'ACCOUNT_SUSPENDED');
    }

    // Rotate token within the same family
    const { accessToken, refreshToken, familyId } = this.generateTokens(user, existingToken.familyId);
    const newExpiresAt = new Date();
    newExpiresAt.setDate(newExpiresAt.getDate() + env.JWT_REFRESH_EXPIRY_DAYS);
    const newTokenH = hashToken(refreshToken);

    existingToken.revokedAt = new Date();
    existingToken.replacedBy = newTokenH;
    await existingToken.save();

    await RefreshToken.create({
      userId: user._id,
      tokenHash: newTokenH,
      familyId,
      expiresAt: newExpiresAt,
    });

    return {
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
      },
      tokens: { accessToken, refreshToken },
    };
  }

  static async logout(token: string): Promise<void> {
    if (!token) return;
    const tokenH = hashToken(token);
    await RefreshToken.updateOne({ tokenHash: tokenH }, { revokedAt: new Date() });
  }

  static async logoutAll(userId: string): Promise<void> {
    await RefreshToken.updateMany(
      { userId: new Types.ObjectId(userId), revokedAt: { $exists: false } },
      { revokedAt: new Date() },
    );
  }

  static async changePassword(userId: string, input: ChangePasswordInput): Promise<void> {
    const user = await User.findById(userId).select('+passwordHash');
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const isMatch = await argon2.verify(user.passwordHash, input.currentPassword);
    if (!isMatch) {
      throw AppError.unauthorized('Current password is incorrect', 'INVALID_CREDENTIALS');
    }

    user.passwordHash = await argon2.hash(input.newPassword, {
      type: argon2.argon2id,
      memoryCost: 65536,
      timeCost: 3,
    });
    await user.save();

    // Revoke all existing refresh sessions
    await this.logoutAll(userId);
  }
}
