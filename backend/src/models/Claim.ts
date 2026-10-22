import type pg from 'pg';
import { query, withTransaction } from '../config/db.js';
import { ClaimStatus, ItemType } from '@returnit/shared';

export interface IClaim {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  itemOwnerId: string;
  itemOwnerName: string;
  itemOwnerEmail: string;
  claimantId: string;
  claimantName: string;
  claimantEmail: string;
  answers: string;
  status: ClaimStatus;
  decidedAt?: Date;
  createdAt: Date;
}

interface ClaimRow {
  id: string;
  item_id: string;
  claimant_id: string;
  answers: string;
  status: string;
  decided_at: Date | null;
  created_at: Date;
  item_title: string;
  item_type: string;
  item_owner_id: string;
  item_owner_name: string;
  item_owner_email: string;
  claimant_name: string;
  claimant_email: string;
}

const SELECT_CLAIM = `
  SELECT c.id, c.item_id, c.claimant_id, c.answers, c.status, c.decided_at, c.created_at,
         i.title AS item_title, i.type AS item_type, i.owner_id AS item_owner_id,
         uo.name AS item_owner_name, uo.email AS item_owner_email,
         uc.name AS claimant_name, uc.email AS claimant_email
  FROM claims c
  JOIN items i ON i.id = c.item_id
  JOIN users uo ON uo.id = i.owner_id
  JOIN users uc ON uc.id = c.claimant_id
`;

function toClaim(row: ClaimRow): IClaim {
  return {
    id: row.id,
    itemId: row.item_id,
    itemTitle: row.item_title,
    itemType: row.item_type as ItemType,
    itemOwnerId: row.item_owner_id,
    itemOwnerName: row.item_owner_name,
    itemOwnerEmail: row.item_owner_email,
    claimantId: row.claimant_id,
    claimantName: row.claimant_name,
    claimantEmail: row.claimant_email,
    answers: row.answers,
    status: row.status as ClaimStatus,
    decidedAt: row.decided_at ?? undefined,
    createdAt: row.created_at,
  };
}

function audit(from: ClaimStatus | null, to: ClaimStatus, actor: string, note: string): string {
  return JSON.stringify([{ fromStatus: from, toStatus: to, actor, at: new Date().toISOString(), note }]);
}

/** Reopen a listing that was waiting on requests once no pending request remains. */
async function reopenIfIdle(client: pg.PoolClient, itemId: string): Promise<void> {
  await client.query(
    `UPDATE items SET status = 'open', updated_at = NOW()
     WHERE id = $1 AND status = 'claim_pending'
       AND NOT EXISTS (SELECT 1 FROM claims WHERE item_id = $1 AND status = 'pending')`,
    [itemId],
  );
}

export const Claim = {
  async findById(id: string): Promise<IClaim | null> {
    const res = await query<ClaimRow>(`${SELECT_CLAIM} WHERE c.id = $1`, [id]);
    return res.rows[0] ? toClaim(res.rows[0]) : null;
  },

  async findByUser(userId: string): Promise<IClaim[]> {
    const res = await query<ClaimRow>(`${SELECT_CLAIM} WHERE c.claimant_id = $1 OR i.owner_id = $1 ORDER BY c.created_at DESC`, [userId]);
    return res.rows.map(toClaim);
  },

  async findActiveByItemAndClaimant(itemId: string, claimantId: string): Promise<IClaim | null> {
    const res = await query<ClaimRow>(
      `${SELECT_CLAIM} WHERE c.item_id = $1 AND c.claimant_id = $2 AND c.status IN ('pending', 'approved')
       ORDER BY c.created_at DESC LIMIT 1`,
      [itemId, claimantId],
    );
    return res.rows[0] ? toClaim(res.rows[0]) : null;
  },

  /** Latest request status per item for the given requester (any status). */
  async latestStatusForItems(claimantId: string, itemIds: string[]): Promise<Map<string, ClaimStatus>> {
    const map = new Map<string, ClaimStatus>();
    if (itemIds.length === 0) return map;
    const res = await query<{ item_id: string; status: string }>(
      `SELECT DISTINCT ON (item_id) item_id, status FROM claims
       WHERE claimant_id = $1 AND item_id = ANY($2::uuid[])
       ORDER BY item_id, created_at DESC`,
      [claimantId, itemIds],
    );
    for (const r of res.rows) map.set(r.item_id, r.status as ClaimStatus);
    return map;
  },

  async hasClaimed(itemId: string, claimantId: string): Promise<boolean> {
    const res = await query('SELECT 1 FROM claims WHERE item_id = $1 AND claimant_id = $2 LIMIT 1', [itemId, claimantId]);
    return res.rows.length > 0;
  },

  async countPendingReceived(ownerId: string): Promise<number> {
    const res = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM claims c JOIN items i ON i.id = c.item_id WHERE i.owner_id = $1 AND c.status = 'pending'`,
      [ownerId],
    );
    return Number(res.rows[0]?.n ?? 0);
  },

  async create(data: { itemId: string; claimantId: string; answers: string }): Promise<IClaim> {
    const id = await withTransaction(async (client) => {
      const res = await client.query<{ id: string }>(
        `INSERT INTO claims (item_id, claimant_id, answers, audit_trail) VALUES ($1, $2, $3, $4::jsonb) RETURNING id`,
        [data.itemId, data.claimantId, data.answers, audit(null, ClaimStatus.PENDING, data.claimantId, 'Request created')],
      );
      await client.query(`UPDATE items SET status = 'claim_pending', updated_at = NOW() WHERE id = $1 AND status = 'open'`, [data.itemId]);
      return res.rows[0].id;
    });
    return (await this.findById(id))!;
  },

  /** Returns null when the request was no longer pending (already decided by someone else). */
  async approve(claimId: string, ownerId: string): Promise<IClaim | null> {
    const ok = await withTransaction(async (client) => {
      const updated = await client.query<{ item_id: string }>(
        `UPDATE claims SET status = 'approved', decided_at = NOW(), updated_at = NOW(),
                audit_trail = audit_trail || $2::jsonb
         WHERE id = $1 AND status = 'pending' RETURNING item_id`,
        [claimId, audit(ClaimStatus.PENDING, ClaimStatus.APPROVED, ownerId, 'Request approved by owner')],
      );
      const itemId = updated.rows[0]?.item_id;
      if (!itemId) return false;
      // Lock the listing so two approvals cannot both resolve it.
      const item = await client.query(`SELECT status FROM items WHERE id = $1 FOR UPDATE`, [itemId]);
      if (item.rows[0]?.status === 'resolved') throw new ClaimConflict();
      await client.query(`UPDATE items SET status = 'resolved', updated_at = NOW() WHERE id = $1`, [itemId]);
      await client.query(
        `UPDATE claims SET status = 'rejected', decided_at = NOW(), updated_at = NOW(),
                audit_trail = audit_trail || $3::jsonb
         WHERE item_id = $1 AND id <> $2 AND status = 'pending'`,
        [itemId, claimId, audit(ClaimStatus.PENDING, ClaimStatus.REJECTED, ownerId, 'Another request was approved')],
      );
      return true;
    });
    return ok ? this.findById(claimId) : null;
  },

  async reject(claimId: string, ownerId: string): Promise<IClaim | null> {
    return this.decide(claimId, ClaimStatus.REJECTED, ownerId, 'Request declined by owner');
  },

  async withdraw(claimId: string, claimantId: string): Promise<IClaim | null> {
    return this.decide(claimId, ClaimStatus.WITHDRAWN, claimantId, 'Request withdrawn by requester');
  },

  async decide(claimId: string, to: ClaimStatus, actor: string, note: string): Promise<IClaim | null> {
    const ok = await withTransaction(async (client) => {
      const updated = await client.query<{ item_id: string }>(
        `UPDATE claims SET status = $2, decided_at = NOW(), updated_at = NOW(), audit_trail = audit_trail || $3::jsonb
         WHERE id = $1 AND status = 'pending' RETURNING item_id`,
        [claimId, to, audit(ClaimStatus.PENDING, to, actor, note)],
      );
      const itemId = updated.rows[0]?.item_id;
      if (!itemId) return false;
      await reopenIfIdle(client, itemId);
      return true;
    });
    return ok ? this.findById(claimId) : null;
  },
};

export class ClaimConflict extends Error {
  constructor() {
    super('This listing has already been resolved');
  }
}
