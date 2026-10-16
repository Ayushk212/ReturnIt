import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { validateBody } from '../middleware/validate.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { User } from '../models/User.js';
import { Item } from '../models/Item.js';
import { RefreshToken } from '../models/RefreshToken.js';
import { UpdateProfileSchema, PublicUserProfile } from '@returnit/shared';

const router = Router();

// GET /users/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      user: {
        _id: req.user!._id,
        name: req.user!.name,
        email: req.user!.email,
        phone: req.user!.phone,
        bio: req.user!.bio,
        avatarUrl: req.user!.avatarUrl,
        role: req.user!.role,
        status: req.user!.status,
        trustScore: req.user!.trustScore,
        createdAt: req.user!.createdAt,
      },
    });
  }),
);

// PATCH /users/me (Strict whitelist: ignore any role, status, trustScore, email)
router.patch(
  '/me',
  authenticate,
  validateBody(UpdateProfileSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;

    if (req.body.name !== undefined) user.name = req.body.name;
    if (req.body.bio !== undefined) user.bio = req.body.bio;
    if (req.body.avatarUrl !== undefined) user.avatarUrl = req.body.avatarUrl;
    if (req.body.phone !== undefined) user.phone = req.body.phone;

    await user.save();

    res.status(200).json({
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
    });
  }),
);

// DELETE /users/me (Anonymize user data per ARCHITECTURE.md rule)
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const user = req.user!;
    const randomizedSuffix = crypto.randomBytes(4).toString('hex');

    user.name = 'Anonymous User';
    user.email = `deleted-${user._id}-${randomizedSuffix}@returnit.local`;
    user.phone = undefined;
    user.bio = '';
    user.avatarUrl = undefined;
    await user.save();

    // Revoke all active sessions
    await RefreshToken.updateMany({ userId: user._id }, { revokedAt: new Date() });
    res.clearCookie('refreshToken', { path: '/api/auth' });

    res.status(200).json({ message: 'Account successfully anonymized and deleted' });
  }),
);

// GET /users/:id (PUBLIC fields only — never email, phone, or passwordHash)
router.get(
  '/:id',
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(req.params.id);
    if (!user) {
      throw AppError.notFound('User not found');
    }

    const listingsCount = await Item.countDocuments({ owner: user._id });

    const publicProfile: PublicUserProfile = {
      _id: user._id.toString(),
      name: user.name,
      avatarUrl: user.avatarUrl,
      bio: user.bio,
      trustScore: user.trustScore,
      createdAt: user.createdAt.toISOString(),
      listingsCount,
    };

    res.status(200).json({ user: publicProfile });
  }),
);

// GET /users/:id/listings (Paginated public listings)
router.get(
  '/:id/listings',
  asyncHandler(async (req: Request, res: Response) => {
    const limit = Math.min(Math.max(Number(req.query.limit) || 20, 1), 50);
    const cursor = req.query.cursor as string;

    const query: Record<string, unknown> = {
      owner: req.params.id,
      status: { $in: ['open', 'claim_pending', 'resolved'] },
    };

    if (cursor) {
      query._id = { $lt: cursor };
    }

    const items = await Item.find(query)
      .sort({ _id: -1 })
      .limit(limit + 1)
      .select('-verificationAnswerHash');

    const hasMore = items.length > limit;
    const results = hasMore ? items.slice(0, limit) : items;
    const nextCursor = hasMore && results.length > 0 ? results[results.length - 1]._id.toString() : undefined;

    res.status(200).json({
      items: results,
      hasMore,
      nextCursor,
    });
  }),
);

export default router;
