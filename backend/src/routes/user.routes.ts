import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { OnboardingSchema, UpdateMyProfileSchema, composeBio } from '@returnit/shared';
import { authenticate, clearAuthCache, optionalAuthenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { photoUpload, sendImage, uuidParam } from '../utils/http.js';
import { processAvatar } from '../utils/images.js';
import { User } from '../models/User.js';
import { Item } from '../models/Item.js';
import { Claim } from '../models/Claim.js';
import { Conversation } from '../models/Conversation.js';
import { formatItem, formatMe, formatPublicUser } from './format.js';

const router = Router();

function validation(message?: string): AppError {
  return AppError.badRequest(message ?? 'Please check the highlighted fields', 'VALIDATION_ERROR');
}

// GET /api/users/me
router.get(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ user: formatMe(req, req.user!, await Item.countByOwner(req.user!.id)) });
  }),
);

// GET /api/users/me/summary — counts for navigation badges
router.get(
  '/me/summary',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const [unreadMessages, pendingRequests] = await Promise.all([
      Conversation.unreadTotal(req.user!.id),
      Claim.countPendingReceived(req.user!.id),
    ]);
    res.json({ unreadMessages, pendingRequests });
  }),
);

// POST /api/users/me/onboarding — first-time profile details
router.post(
  '/me/onboarding',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = OnboardingSchema.safeParse(req.body);
    if (!parsed.success) throw validation(parsed.error.errors[0]?.message);
    const d = parsed.data;
    const updated = await User.updateProfile(req.user!.id, {
      name: d.name,
      programme: d.programme,
      academicYear: d.academicYear,
      branch: d.branch,
      section: d.section,
      bio: composeBio(d),
      markOnboarded: true,
    });
    clearAuthCache(req.user!.id);
    res.json({ user: formatMe(req, updated!, await Item.countByOwner(req.user!.id)) });
  }),
);

// PATCH /api/users/me — edit name, academic details or bio
router.patch(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const body = { ...req.body } as Record<string, unknown>;
    const bio = typeof body.bio === 'string' ? body.bio.trim() : undefined;
    delete body.bio;
    if (bio !== undefined && bio.length > 500) throw validation('Bio is limited to 500 characters');
    const parsed = UpdateMyProfileSchema.safeParse(body);
    if (!parsed.success) throw validation(parsed.error.errors[0]?.message);
    const d = parsed.data;
    const updated = await User.updateProfile(req.user!.id, {
      name: d.name,
      programme: d.programme,
      academicYear: d.academicYear,
      branch: d.branch,
      section: d.section,
      bio,
    });
    clearAuthCache(req.user!.id);
    res.json({ user: formatMe(req, updated!, await Item.countByOwner(req.user!.id)) });
  }),
);

// POST /api/users/me/avatar — compressed to a 320px WebP and stored in the database
router.post(
  '/me/avatar',
  authenticate,
  photoUpload('avatar', 1),
  asyncHandler(async (req: Request, res: Response) => {
    if (!req.file) throw AppError.badRequest('Choose a photo to upload');
    const { data, mime } = await processAvatar(req.file.buffer);
    const updated = await User.setAvatar(req.user!.id, mime, data);
    clearAuthCache(req.user!.id);
    res.json({ user: formatMe(req, updated!, await Item.countByOwner(req.user!.id)) });
  }),
);

// DELETE /api/users/me/avatar
router.delete(
  '/me/avatar',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await User.removeAvatar(req.user!.id);
    clearAuthCache(req.user!.id);
    res.json({ user: formatMe(req, updated!, await Item.countByOwner(req.user!.id)) });
  }),
);

// DELETE /api/users/me — anonymise personal data
router.delete(
  '/me',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    await User.anonymize(req.user!.id, crypto.randomBytes(4).toString('hex'));
    clearAuthCache(req.user!.id);
    res.json({ message: 'Your personal data has been removed' });
  }),
);

// GET /api/users/:id — public profile (never includes email or phone)
router.get(
  '/:id',
  uuidParam('id', 'member'),
  asyncHandler(async (req: Request, res: Response) => {
    const user = await User.findById(String(req.params.id));
    if (!user) throw AppError.notFound('This member could not be found');
    res.json({ user: formatPublicUser(req, user, await Item.countByOwner(user.id)) });
  }),
);

// GET /api/users/:id/avatar
router.get(
  '/:id/avatar',
  uuidParam('id', 'photo'),
  asyncHandler(async (req: Request, res: Response) => {
    const avatar = await User.getAvatar(String(req.params.id));
    if (!avatar) throw AppError.notFound('No profile photo');
    sendImage(res, avatar.mime, avatar.data);
  }),
);

// GET /api/users/:id/listings — a member's active listings
router.get(
  '/:id/listings',
  uuidParam('id', 'member'),
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const items = await Item.findByOwner(String(req.params.id), true);
    const viewer = req.user
      ? { id: req.user.id, saved: await User.getSavedItemIds(req.user.id), claims: await Claim.latestStatusForItems(req.user.id, items.map((i) => i.id)) }
      : undefined;
    res.json({ items: items.map((i) => formatItem(req, i, viewer)) });
  }),
);

export default router;
