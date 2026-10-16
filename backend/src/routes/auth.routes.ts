import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';

const router = Router();

// GET /api/auth/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      user: {
        _id: req.user!._id,
        firebaseUid: req.user!.firebaseUid,
        name: req.user!.name,
        email: req.user!.email,
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

export default router;
