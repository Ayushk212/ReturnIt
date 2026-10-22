import crypto from 'node:crypto';
import { Router, Request, Response } from 'express';
import { ItemCategory, ItemStatus, ItemType, ReportListingSchema, ReportTargetType } from '@returnit/shared';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { claimLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { photoUpload, sendImage, uuidParam } from '../utils/http.js';
import { processListingImage } from '../utils/images.js';
import { Item, IItem } from '../models/Item.js';
import { Claim } from '../models/Claim.js';
import { User } from '../models/User.js';
import { Report } from '../models/Report.js';
import { formatClaim, formatItem } from './format.js';

const router = Router();
const MAX_PHOTOS = 5;

async function viewerContext(userId: string | undefined, items: IItem[]) {
  if (!userId) return undefined;
  const [saved, claims] = await Promise.all([
    User.getSavedItemIds(userId),
    Claim.latestStatusForItems(userId, items.map((i) => i.id)),
  ]);
  return { id: userId, saved, claims };
}

const str = (v: unknown) => (typeof v === 'string' ? v : undefined);

// GET /api/items — public board, or the signed-in user's own (?mine=true) and saved (?saved=true) lists.
router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { mine, saved } = req.query;
    if ((mine === 'true' || saved === 'true') && !req.user) {
      throw AppError.unauthorized('Please sign in to view your listings');
    }
    let items: IItem[];
    if (mine === 'true') items = await Item.findByOwner(req.user!.id);
    else if (saved === 'true') items = await Item.findSaved(req.user!.id);
    else {
      items = await Item.findBoard({
        type: str(req.query.type),
        category: str(req.query.category),
        q: str(req.query.q)?.slice(0, 100),
        location: str(req.query.location)?.slice(0, 100),
        status: req.query.status === 'resolved' ? 'resolved' : 'active',
      });
    }
    const viewer = await viewerContext(req.user?.id, items);
    res.json({ items: items.map((i) => formatItem(req, i, viewer)) });
  }),
);

// GET /api/items/:id
router.get(
  '/:id',
  uuidParam('id', 'listing'),
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(String(req.params.id));
    if (!item || item.status === ItemStatus.REMOVED) throw AppError.notFound('This listing no longer exists');
    const viewer = await viewerContext(req.user?.id, [item]);
    res.json(formatItem(req, item, viewer));
  }),
);

// GET /api/items/:id/photos/:position(?size=thumb) — compressed WebP served from the database.
router.get(
  '/:id/photos/:position',
  uuidParam('id', 'photo'),
  asyncHandler(async (req: Request, res: Response) => {
    const position = Number(req.params.position);
    if (!Number.isInteger(position) || position < 0 || position >= MAX_PHOTOS) throw AppError.notFound('Photo not found');
    const photo = await Item.getPhoto(String(req.params.id), position, req.query.size === 'thumb' ? 'thumb' : 'full');
    if (!photo) throw AppError.notFound('Photo not found');
    sendImage(res, photo.mime, photo.data);
  }),
);

// GET /api/items/:id/matches — likely counterparts (found items for a lost report, and vice versa).
router.get(
  '/:id/matches',
  uuidParam('id', 'listing'),
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(String(req.params.id));
    if (!item) throw AppError.notFound('This listing no longer exists');
    const matches = await Item.findMatches(item);
    const viewer = await viewerContext(req.user?.id, matches);
    res.json({ items: matches.map((i) => formatItem(req, i, viewer)) });
  }),
);

// POST /api/items — multipart form with up to five photos.
router.post(
  '/',
  authenticate,
  photoUpload('images', MAX_PHOTOS),
  asyncHandler(async (req: Request, res: Response) => {
    const userId = req.user!.id;
    const idempotencyKey = str(req.headers['idempotency-key'])?.slice(0, 100);
    if (idempotencyKey) {
      const existing = await Item.findByIdempotency(idempotencyKey, userId);
      if (existing) {
        res.status(200).json(formatItem(req, existing, await viewerContext(userId, [existing])));
        return;
      }
    }

    const { type, category, verificationAnswer } = req.body as Record<string, string | undefined>;
    const title = str(req.body.title)?.trim() ?? '';
    const description = str(req.body.description)?.trim() ?? '';
    const locationLabel = str(req.body.locationLabel)?.trim() ?? '';
    const verificationQuestion = str(req.body.verificationQuestion)?.trim() ?? '';

    if (type !== ItemType.LOST && type !== ItemType.FOUND) throw AppError.badRequest('Type must be either lost or found', 'VALIDATION_ERROR');
    if (title.length < 3 || title.length > 80) throw AppError.badRequest('Title must be between 3 and 80 characters', 'VALIDATION_ERROR');
    if (description.length < 10 || description.length > 1000) throw AppError.badRequest('Description must be between 10 and 1,000 characters', 'VALIDATION_ERROR');
    if (!category || !(Object.values(ItemCategory) as string[]).includes(category)) throw AppError.badRequest('Choose a valid category', 'VALIDATION_ERROR');
    if (locationLabel.length < 2 || locationLabel.length > 200) throw AppError.badRequest('Location is required', 'VALIDATION_ERROR');

    const occurred = req.body.dateOccurred ? new Date(String(req.body.dateOccurred)) : new Date();
    if (Number.isNaN(occurred.getTime())) throw AppError.badRequest('Invalid date', 'VALIDATION_ERROR');
    if (occurred.getTime() > Date.now() + 60 * 60 * 1000) throw AppError.badRequest('The date cannot be in the future', 'VALIDATION_ERROR');

    let answerHash: string | undefined;
    if (type === ItemType.FOUND) {
      if (verificationQuestion.length < 5 || verificationQuestion.length > 140) {
        throw AppError.badRequest('Add a verification question only the owner could answer', 'VALIDATION_ERROR');
      }
      const answer = (verificationAnswer ?? '').trim().toLowerCase();
      if (!answer) throw AppError.badRequest('Enter the answer to your verification question', 'VALIDATION_ERROR');
      answerHash = crypto.createHash('sha256').update(answer).digest('hex');
    }

    const files = (req.files as Express.Multer.File[] | undefined) ?? [];
    const photos = [];
    for (const file of files) photos.push(await processListingImage(file.buffer));

    const item = await Item.create({
      type,
      title,
      description,
      category: category as ItemCategory,
      locationLabel,
      dateOccurred: occurred,
      photos,
      ownerId: userId,
      verificationQuestion: type === ItemType.FOUND ? verificationQuestion : undefined,
      verificationAnswerHash: answerHash,
      idempotencyKey,
    });
    res.status(201).json(formatItem(req, item, await viewerContext(userId, [item])));
  }),
);

// POST /api/items/:id/save — toggle bookmark
router.post(
  '/:id/save',
  uuidParam('id', 'listing'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(String(req.params.id));
    if (!item) throw AppError.notFound('Listing not found');
    res.json({ saved: await User.toggleSaved(req.user!.id, item.id) });
  }),
);

async function ownedItem(req: Request): Promise<IItem> {
  const item = await Item.findById(String(req.params.id));
  if (!item) throw AppError.notFound('Listing not found');
  if (item.ownerId !== req.user!.id) throw AppError.forbidden('Only the person who posted this listing can do that');
  return item;
}

// POST /api/items/:id/resolve
router.post(
  '/:id/resolve',
  uuidParam('id', 'listing'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await ownedItem(req);
    const updated = await Item.updateStatus(item.id, ItemStatus.RESOLVED);
    res.json(formatItem(req, updated!, await viewerContext(req.user!.id, [updated!])));
  }),
);

// POST /api/items/:id/renew — extend an active listing by 90 days
router.post(
  '/:id/renew',
  uuidParam('id', 'listing'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await ownedItem(req);
    if (item.status === ItemStatus.RESOLVED || item.status === ItemStatus.REMOVED) {
      throw AppError.conflict('Closed listings cannot be renewed');
    }
    const updated = await Item.renew(item.id);
    res.json(formatItem(req, updated!, await viewerContext(req.user!.id, [updated!])));
  }),
);

// POST /api/items/:id/claims
router.post(
  '/:id/claims',
  uuidParam('id', 'listing'),
  authenticate,
  claimLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(String(req.params.id));
    if (!item) throw AppError.notFound('This listing no longer exists');
    if (item.ownerId === req.user!.id) throw AppError.forbidden('You cannot send a request on your own listing');
    if (item.status === ItemStatus.RESOLVED || item.status === ItemStatus.EXPIRED || item.status === ItemStatus.REMOVED) {
      throw AppError.conflict('This listing is closed');
    }
    const message = (str(req.body?.message) ?? '').trim();
    if (message.length < 10 || message.length > 1000) throw AppError.badRequest('Please write between 10 and 1,000 characters');
    if (await Claim.findActiveByItemAndClaimant(item.id, req.user!.id)) {
      throw AppError.conflict('You already have an active request on this listing');
    }
    const claim = await Claim.create({ itemId: item.id, claimantId: req.user!.id, answers: message });
    res.status(201).json(formatClaim(claim, req.user!.id));
  }),
);

// POST /api/items/:id/report — flag a listing for moderators
router.post(
  '/:id/report',
  uuidParam('id', 'listing'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(String(req.params.id));
    if (!item) throw AppError.notFound('This listing no longer exists');
    if (item.ownerId === req.user!.id) throw AppError.badRequest('You cannot report your own listing');
    const parsed = ReportListingSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid report', 'VALIDATION_ERROR');
    const created = await Report.create({
      reporterId: req.user!.id,
      targetType: ReportTargetType.ITEM,
      targetId: item.id,
      reason: parsed.data.reason,
      details: parsed.data.details,
    });
    res.status(created ? 201 : 200).json({ reported: true, alreadyReported: !created });
  }),
);

export default router;
