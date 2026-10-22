import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { formatMe } from './format.js';

const router = Router();

// GET /api/auth/me — confirms the token is accepted and returns the application profile
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: formatMe(req, req.user!) });
  }),
);

export default router;
