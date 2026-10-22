import { Router, Request, Response } from 'express';
import { authenticate } from '../middleware/auth.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { uuidParam } from '../utils/http.js';
import { Claim, ClaimConflict, IClaim } from '../models/Claim.js';
import { formatClaim } from './format.js';

const router = Router();

// GET /api/claims — requests sent and received by the signed-in user
router.get(
  '/',
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claims = await Claim.findByUser(req.user!.id);
    res.json({ claims: claims.map((c) => formatClaim(c, req.user!.id)) });
  }),
);

async function loadClaim(req: Request): Promise<IClaim> {
  const claim = await Claim.findById(String(req.params.id));
  if (!claim) throw AppError.notFound('Request not found');
  return claim;
}

function requireOwner(req: Request, claim: IClaim, action: string): void {
  if (claim.itemOwnerId !== req.user!.id) throw AppError.forbidden(`Only the listing owner can ${action} requests`);
}

function handled(updated: IClaim | null): IClaim {
  if (!updated) throw AppError.conflict('This request has already been handled');
  return updated;
}

router.post(
  '/:id/approve',
  uuidParam('id', 'request'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await loadClaim(req);
    requireOwner(req, claim, 'approve');
    try {
      res.json(formatClaim(handled(await Claim.approve(claim.id, req.user!.id)), req.user!.id));
    } catch (err) {
      if (err instanceof ClaimConflict) throw AppError.conflict(err.message);
      throw err;
    }
  }),
);

router.post(
  '/:id/reject',
  uuidParam('id', 'request'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await loadClaim(req);
    requireOwner(req, claim, 'decline');
    res.json(formatClaim(handled(await Claim.reject(claim.id, req.user!.id)), req.user!.id));
  }),
);

router.post(
  '/:id/withdraw',
  uuidParam('id', 'request'),
  authenticate,
  asyncHandler(async (req: Request, res: Response) => {
    const claim = await loadClaim(req);
    if (claim.claimantId !== req.user!.id) throw AppError.forbidden('Only the requester can withdraw this request');
    res.json(formatClaim(handled(await Claim.withdraw(claim.id, req.user!.id)), req.user!.id));
  }),
);

export default router;
