import { Router, Request, Response } from 'express';
import { AuthService } from '../services/auth.service.js';
import { validateBody } from '../middleware/validate.js';
import { authenticate } from '../middleware/auth.js';
import { authLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { ChangePasswordSchema, LoginSchema, RegisterSchema } from '@returnit/shared';
import { env } from '../config/env.js';

const router = Router();

const COOKIE_OPTIONS = {
  httpOnly: true,
  secure: env.NODE_ENV === 'production',
  sameSite: 'strict' as const,
  maxAge: env.JWT_REFRESH_EXPIRY_DAYS * 24 * 60 * 60 * 1000,
  path: '/api/auth',
};

// Register
router.post(
  '/register',
  authLimiter,
  validateBody(RegisterSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await AuthService.register(req.body);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
    res.status(201).json({
      user,
      accessToken: tokens.accessToken,
    });
  }),
);

// Login
router.post(
  '/login',
  authLimiter,
  validateBody(LoginSchema),
  asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await AuthService.login(req.body);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      user,
      accessToken: tokens.accessToken,
    });
  }),
);

// Refresh Token
router.post(
  '/refresh',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    const { user, tokens } = await AuthService.refresh(token);
    res.cookie('refreshToken', tokens.refreshToken, COOKIE_OPTIONS);
    res.status(200).json({
      user,
      accessToken: tokens.accessToken,
    });
  }),
);

// Logout
router.post(
  '/logout',
  asyncHandler(async (req: Request, res: Response) => {
    const token = req.cookies?.refreshToken || req.body?.refreshToken;
    if (token) {
      await AuthService.logout(token);
    }
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ message: 'Successfully logged out' });
  }),
);

// Logout All
router.post(
  '/logout-all',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await AuthService.logoutAll(req.user!._id.toString());
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ message: 'All sessions successfully revoked' });
  }),
);

// Me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.status(200).json({
      user: {
        _id: req.user!._id,
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

// Change Password
router.post(
  '/change-password',
  authenticate,
  validateBody(ChangePasswordSchema),
  asyncHandler(async (req: Request, res: Response) => {
    await AuthService.changePassword(req.user!._id.toString(), req.body);
    res.clearCookie('refreshToken', { path: '/api/auth' });
    res.status(200).json({ message: 'Password updated successfully. Please log in again.' });
  }),
);

export default router;
