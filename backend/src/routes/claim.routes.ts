import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { Claim } from '../models/Claim.js';
import { Item, IItem } from '../models/Item.js';
import { ClaimStatus, ItemStatus } from '@returnit/shared';
import { formatClaim } from './item.routes.js';

const router = Router();

function extractEntityId(entity: unknown): string {
  if (!entity) return '';
  if (typeof entity === 'object' && entity !== null && '_id' in entity) {
    const id = (entity as { _id: unknown })._id;
    return id ? String(id) : '';
  }
  return String(entity);
}

// GET /api/claims
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const currentUserId = req.user!._id;

    // Find items owned by current user
    const userItems = await Item.find({ owner: currentUserId }).select('_id');
    const userItemIds = userItems.map((i) => i._id);

    // Find claims where user is claimant OR item belongs to user
    const claims = await Claim.find({
      $or: [{ claimant: currentUserId }, { item: { $in: userItemIds } }],
    })
      .sort({ createdAt: -1 })
      .populate('claimant', 'name email')
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'name email' },
      })
      .exec();

    const formatted = claims.map((c) => formatClaim(c, currentUserId.toString()));

    res.status(200).json({ claims: formatted });
  }),
);

// POST /api/claims/:id/approve
router.post(
  '/:id/approve',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await Claim.findById(req.params.id)
      .populate('claimant', 'name email')
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'name email' },
      })
      .exec();

    if (!claim) {
      throw AppError.notFound('Request not found');
    }

    const item = claim.item as unknown as IItem;
    if (!item) {
      throw AppError.notFound('Associated listing not found');
    }

    const ownerId = extractEntityId(item.owner);
    if (ownerId !== req.user!._id.toString()) {
      throw AppError.forbidden('Only the listing owner can approve requests');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw AppError.conflict('This request has already been handled');
    }

    claim.status = ClaimStatus.APPROVED;
    claim.decidedAt = new Date();
    await claim.save();

    item.status = ItemStatus.RESOLVED;
    await (item as unknown as { save(): Promise<void> }).save();

    // Reject other pending claims on this item
    await Claim.updateMany(
      { item: item._id, _id: { $ne: claim._id }, status: ClaimStatus.PENDING },
      { status: ClaimStatus.REJECTED, decidedAt: new Date() },
    );

    res.status(200).json(formatClaim(claim, req.user!._id.toString()));
  }),
);

// POST /api/claims/:id/reject
router.post(
  '/:id/reject',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await Claim.findById(req.params.id)
      .populate('claimant', 'name email')
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'name email' },
      })
      .exec();

    if (!claim) {
      throw AppError.notFound('Request not found');
    }

    const item = claim.item as unknown as IItem;
    if (!item) {
      throw AppError.notFound('Associated listing not found');
    }

    const ownerId = extractEntityId(item.owner);
    if (ownerId !== req.user!._id.toString()) {
      throw AppError.forbidden('Only the listing owner can reject requests');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw AppError.conflict('This request has already been handled');
    }

    claim.status = ClaimStatus.REJECTED;
    claim.decidedAt = new Date();
    await claim.save();

    const pendingCount = await Claim.countDocuments({
      item: item._id,
      status: ClaimStatus.PENDING,
    });
    if (pendingCount === 0 && item.status === ItemStatus.CLAIM_PENDING) {
      item.status = ItemStatus.OPEN;
      await (item as unknown as { save(): Promise<void> }).save();
    }

    res.status(200).json(formatClaim(claim, req.user!._id.toString()));
  }),
);

// POST /api/claims/:id/withdraw
router.post(
  '/:id/withdraw',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await Claim.findById(req.params.id)
      .populate('claimant', 'name email')
      .populate({
        path: 'item',
        populate: { path: 'owner', select: 'name email' },
      })
      .exec();

    if (!claim) {
      throw AppError.notFound('Request not found');
    }

    const claimantId = extractEntityId(claim.claimant);
    if (claimantId !== req.user!._id.toString()) {
      throw AppError.forbidden('Only the requester can withdraw this request');
    }

    if (claim.status !== ClaimStatus.PENDING) {
      throw AppError.conflict('This request has already been handled');
    }

    claim.status = ClaimStatus.WITHDRAWN;
    claim.decidedAt = new Date();
    await claim.save();

    const item = claim.item as unknown as IItem;
    if (item) {
      const pendingCount = await Claim.countDocuments({
        item: item._id,
        status: ClaimStatus.PENDING,
      });
      if (pendingCount === 0 && item.status === ItemStatus.CLAIM_PENDING) {
        item.status = ItemStatus.OPEN;
        await (item as unknown as { save(): Promise<void> }).save();
      }
    }

    res.status(200).json(formatClaim(claim, req.user!._id.toString()));
  }),
);

export default router;
