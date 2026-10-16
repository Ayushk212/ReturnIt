import crypto from 'node:crypto';
import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate, optionalAuthenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { Item, IItem, IItemImage } from '../models/Item.js';
import { Claim, IClaim } from '../models/Claim.js';
import { User, IUser } from '../models/User.js';
import { ClaimStatus, ItemCategory, ItemStatus, ItemType } from '@returnit/shared';

const router = Router();

// Configure multer memory storage
const storage = multer.memoryStorage();
const upload = multer({
  storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB
    files: 5,
  },
  fileFilter: (_req, file, cb) => {
    const allowed = ['image/jpeg', 'image/png', 'image/webp'];
    if (!allowed.includes(file.mimetype)) {
      return cb(new AppError(400, 'Only JPEG, PNG, and WebP images are allowed', 'INVALID_FILE_TYPE'));
    }
    cb(null, true);
  },
});

export function formatItem(
  item: IItem,
  currentUserId?: string,
  savedItemIds?: Set<string>,
  claimStatus?: ClaimStatus,
) {
  const ownerDoc = item.owner as unknown as IUser;
  const ownerName = ownerDoc && typeof ownerDoc === 'object' && 'name' in ownerDoc ? ownerDoc.name : 'Member';
  const ownerId = ownerDoc && typeof ownerDoc === 'object' && '_id' in ownerDoc
    ? String(ownerDoc._id)
    : String(item.owner);
  const isOwner = !!currentUserId && ownerId === currentUserId;
  const saved = !!savedItemIds && savedItemIds.has(item._id.toString());

  return {
    id: item._id.toString(),
    type: item.type,
    title: item.title,
    description: item.description,
    category: item.category,
    locationLabel: item.location?.label ?? '',
    dateOccurred: item.dateOccurred.toISOString(),
    createdAt: item.createdAt.toISOString(),
    status: item.status,
    images: (item.images || []).map((img) => ({
      url: img.url,
      alt: img.alt,
    })),
    owner: { name: ownerName },
    isOwner,
    saved,
    verificationQuestion: item.verificationQuestion || undefined,
    myClaimStatus: claimStatus,
  };
}

export function formatClaim(claim: IClaim, currentUserId: string) {
  const item = claim.item as unknown as IItem;
  const claimant = claim.claimant as unknown as IUser;
  const owner = item?.owner as unknown as IUser;

  const isReceived = owner?._id
    ? owner._id.toString() === currentUserId
    : item?.owner?.toString() === currentUserId;
  const counterpartName = isReceived ? claimant?.name ?? 'Requester' : owner?.name ?? 'Owner';

  let contact: { name: string; email: string } | undefined = undefined;
  if (claim.status === ClaimStatus.APPROVED) {
    if (isReceived) {
      contact = { name: claimant?.name ?? 'Requester', email: claimant?.email ?? '' };
    } else {
      contact = { name: owner?.name ?? 'Owner', email: owner?.email ?? '' };
    }
  }

  return {
    id: claim._id.toString(),
    itemId: item?._id ? item._id.toString() : claim.item.toString(),
    itemTitle: item?.title ?? 'Listing',
    itemType: (item?.type ?? 'found') as 'lost' | 'found',
    direction: (isReceived ? 'received' : 'sent') as 'received' | 'sent',
    counterpartName,
    message: claim.answers,
    status: claim.status,
    createdAt: claim.createdAt.toISOString(),
    contact,
  };
}

// GET /api/items
router.get(
  '/',
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const { type, category, q, location, status, mine, saved } = req.query;

    if ((mine === 'true' || saved === 'true') && !req.user) {
      throw AppError.unauthorized('Please sign in to view your items or saved listings');
    }

    const filter: Record<string, unknown> = {};

    if (mine === 'true' && req.user) {
      filter.owner = req.user._id;
    } else if (saved === 'true' && req.user) {
      filter._id = { $in: req.user.savedItems || [] };
    } else {
      if (status === 'resolved') {
        filter.status = ItemStatus.RESOLVED;
      } else {
        filter.status = { $in: [ItemStatus.OPEN, ItemStatus.CLAIM_PENDING] };
      }

      if (type && (type === ItemType.LOST || type === ItemType.FOUND)) {
        filter.type = type;
      }

      if (category && typeof category === 'string') {
        filter.category = category;
      }

      if (location && typeof location === 'string') {
        filter['location.label'] = { $regex: new RegExp(`^${location}`, 'i') };
      }

      if (q && typeof q === 'string' && q.trim()) {
        const searchRegex = new RegExp(q.trim(), 'i');
        filter.$or = [
          { title: { $regex: searchRegex } },
          { description: { $regex: searchRegex } },
          { 'location.label': { $regex: searchRegex } },
        ];
      }
    }

    const items = await Item.find(filter)
      .sort({ createdAt: -1 })
      .populate('owner', 'name')
      .exec();

    const currentUserId = req.user?._id.toString();
    const savedItemIds = new Set(
      (req.user?.savedItems || []).map((id) => id.toString()),
    );

    let userClaims: IClaim[] = [];
    if (currentUserId && items.length > 0) {
      userClaims = await Claim.find({
        claimant: req.user!._id,
        item: { $in: items.map((i) => i._id) },
      }).exec();
    }

    const claimMap = new Map<string, ClaimStatus>();
    for (const claim of userClaims) {
      claimMap.set(claim.item.toString(), claim.status);
    }

    const formatted = items.map((item) =>
      formatItem(item, currentUserId, savedItemIds, claimMap.get(item._id.toString())),
    );

    res.status(200).json({ items: formatted });
  }),
);

// GET /api/items/:id
router.get(
  '/:id',
  optionalAuthenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(req.params.id).populate('owner', 'name').exec();
    if (!item) {
      throw AppError.notFound('This listing no longer exists');
    }

    const currentUserId = req.user?._id.toString();
    const savedItemIds = new Set(
      (req.user?.savedItems || []).map((id) => id.toString()),
    );

    let myClaimStatus: ClaimStatus | undefined = undefined;
    if (currentUserId) {
      const claim = await Claim.findOne({
        claimant: req.user!._id,
        item: item._id,
      })
        .sort({ createdAt: -1 })
        .exec();
      if (claim) myClaimStatus = claim.status;
    }

    res.status(200).json(formatItem(item, currentUserId, savedItemIds, myClaimStatus));
  }),
);

// POST /api/items
router.post(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    upload.array('images', 5)(req, res, (err) => {
      if (err) {
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_SIZE') {
          return next(new AppError(400, 'Image file size cannot exceed 5 MB', 'FILE_TOO_LARGE'));
        }
        if (err instanceof multer.MulterError && err.code === 'LIMIT_FILE_COUNT') {
          return next(new AppError(400, 'Maximum of 5 images allowed', 'TOO_MANY_FILES'));
        }
        return next(err);
      }
      next();
    });
  },
  asyncHandler(async (req: Request, res: Response) => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;
    if (idempotencyKey) {
      const existing = await Item.findOne({ idempotencyKey, owner: req.user!._id })
        .populate('owner', 'name')
        .exec();
      if (existing) {
        const savedIds = new Set((req.user!.savedItems || []).map((id) => id.toString()));
        res.status(200).json(formatItem(existing, req.user!._id.toString(), savedIds));
        return;
      }
    }

    const {
      type,
      title,
      description,
      category,
      locationLabel,
      dateOccurred,
      verificationQuestion,
      verificationAnswer,
    } = req.body;

    if (!type || (type !== ItemType.LOST && type !== ItemType.FOUND)) {
      throw AppError.badRequest('Type must be either lost or found', 'VALIDATION_ERROR');
    }
    if (!title || typeof title !== 'string' || title.trim().length < 3) {
      throw AppError.badRequest('Title must be at least 3 characters long', 'VALIDATION_ERROR');
    }
    if (!description || typeof description !== 'string' || description.trim().length < 5) {
      throw AppError.badRequest('Description must be at least 5 characters long', 'VALIDATION_ERROR');
    }
    if (!category || !Object.values(ItemCategory).includes(category as ItemCategory)) {
      throw AppError.badRequest('Invalid category provided', 'VALIDATION_ERROR');
    }
    if (!locationLabel || typeof locationLabel !== 'string') {
      throw AppError.badRequest('Location is required', 'VALIDATION_ERROR');
    }

    const parsedDate = dateOccurred ? new Date(dateOccurred) : new Date();

    const files = (req.files as Express.Multer.File[]) || [];
    const images: IItemImage[] = files.map((file, idx) => ({
      url: `data:${file.mimetype};base64,${file.buffer.toString('base64')}`,
      publicId: `img-${Date.now()}-${idx}`,
      alt: `${title.trim()} (photo ${idx + 1})`,
      width: 800,
      height: 600,
    }));

    let answerHash: string | undefined = undefined;
    if (verificationAnswer && typeof verificationAnswer === 'string' && verificationAnswer.trim()) {
      answerHash = crypto.createHash('sha256').update(verificationAnswer.trim().toLowerCase()).digest('hex');
    }

    const item = await Item.create({
      type,
      title: title.trim(),
      description: description.trim(),
      category,
      location: {
        label: locationLabel.trim(),
        geo: { type: 'Point', coordinates: [0, 0] },
        radiusMeters: 500,
      },
      dateOccurred: parsedDate,
      status: ItemStatus.OPEN,
      images,
      owner: req.user!._id,
      verificationQuestion: verificationQuestion?.trim() || undefined,
      verificationAnswerHash: answerHash,
      idempotencyKey,
    });

    const populated = await Item.findById(item._id).populate('owner', 'name').exec();
    const savedIds = new Set((req.user!.savedItems || []).map((id) => id.toString()));

    res.status(201).json(formatItem(populated!, req.user!._id.toString(), savedIds));
  }),
);

// POST /api/items/:id/save
router.post(
  '/:id/save',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(req.params.id);
    if (!item) {
      throw AppError.notFound('Listing not found');
    }

    const user = req.user!;
    const itemIdStr = item._id.toString();
    const isSaved = (user.savedItems || []).some((id) => id.toString() === itemIdStr);

    let nextSaved = false;
    if (isSaved) {
      await User.findByIdAndUpdate(user._id, {
        $pull: { savedItems: item._id },
      });
      nextSaved = false;
    } else {
      await User.findByIdAndUpdate(user._id, {
        $addToSet: { savedItems: item._id },
      });
      nextSaved = true;
    }

    res.status(200).json({ saved: nextSaved });
  }),
);

// POST /api/items/:id/resolve
router.post(
  '/:id/resolve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(req.params.id).populate('owner', 'name');
    if (!item) {
      throw AppError.notFound('Listing not found');
    }

    if (item.owner._id.toString() !== req.user!._id.toString()) {
      throw AppError.forbidden('Only the listing owner can resolve this listing');
    }

    item.status = ItemStatus.RESOLVED;
    await item.save();

    const savedIds = new Set((req.user!.savedItems || []).map((id) => id.toString()));
    res.status(200).json(formatItem(item, req.user!._id.toString(), savedIds));
  }),
);

// POST /api/items/:id/claims
router.post(
  '/:id/claims',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const item = await Item.findById(req.params.id).populate('owner', 'name email');
    if (!item) {
      throw AppError.notFound('This listing no longer exists');
    }

    if (item.owner._id.toString() === req.user!._id.toString()) {
      throw AppError.forbidden('You cannot submit a request on your own listing');
    }

    if (item.status === ItemStatus.RESOLVED || item.status === ItemStatus.EXPIRED) {
      throw AppError.conflict('This listing is closed');
    }

    const message = (req.body.message ?? '').trim();
    if (!message || message.length < 2) {
      throw AppError.badRequest('A message is required to submit a claim');
    }

    const existingClaim = await Claim.findOne({
      item: item._id,
      claimant: req.user!._id,
      status: { $in: [ClaimStatus.PENDING, ClaimStatus.APPROVED] },
    });
    if (existingClaim) {
      throw AppError.conflict('You already have an active request on this listing');
    }

    const claim = await Claim.create({
      item: item._id,
      claimant: req.user!._id,
      answers: message,
      status: ClaimStatus.PENDING,
      auditTrail: [
        {
          fromStatus: ClaimStatus.PENDING,
          toStatus: ClaimStatus.PENDING,
          actor: req.user!._id,
          at: new Date(),
          note: 'Request created',
        },
      ],
    });

    if (item.status === ItemStatus.OPEN) {
      item.status = ItemStatus.CLAIM_PENDING;
      await item.save();
    }

    const populatedClaim = await Claim.findById(claim._id)
      .populate('claimant', 'name email')
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'name email' },
      })
      .exec();

    res.status(201).json(formatClaim(populatedClaim!, req.user!._id.toString()));
  }),
);

export default router;
