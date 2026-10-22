import { query, withTransaction } from '../config/db.js';
import { ItemCategory, ItemStatus, ItemType } from '@returnit/shared';
import type { ProcessedImage } from '../utils/images.js';

export interface IPhotoMeta {
  position: number;
  width: number;
  height: number;
}

export interface IItem {
  id: string;
  type: ItemType;
  title: string;
  description: string;
  category: ItemCategory;
  locationLabel: string;
  dateOccurred: Date;
  status: ItemStatus;
  ownerId: string;
  ownerName: string;
  ownerAvatarUrl?: string;
  ownerAvatarVersion: number;
  verificationQuestion?: string;
  verificationAnswerHash?: string;
  photos: IPhotoMeta[];
  expiresAt: Date;
  createdAt: Date;
  updatedAt: Date;
}

interface ItemRow {
  id: string;
  type: string;
  title: string;
  description: string;
  category: string;
  location_label: string;
  date_occurred: Date;
  status: string;
  owner_id: string;
  owner_name: string | null;
  owner_avatar_url: string | null;
  owner_avatar_version: number | null;
  verification_question: string | null;
  verification_answer_hash: string | null;
  photos: IPhotoMeta[] | null;
  expires_at: Date;
  created_at: Date;
  updated_at: Date;
}

// Active listings past their expiry date are reported as expired without a background job.
function effectiveStatus(row: ItemRow): ItemStatus {
  const status = row.status as ItemStatus;
  if ((status === ItemStatus.OPEN || status === ItemStatus.CLAIM_PENDING) && new Date(row.expires_at).getTime() < Date.now()) {
    return ItemStatus.EXPIRED;
  }
  return status;
}

function toItem(row: ItemRow): IItem {
  return {
    id: row.id,
    type: row.type as ItemType,
    title: row.title,
    description: row.description,
    category: row.category as ItemCategory,
    locationLabel: row.location_label,
    dateOccurred: row.date_occurred,
    status: effectiveStatus(row),
    ownerId: row.owner_id,
    ownerName: row.owner_name || 'Member',
    ownerAvatarUrl: row.owner_avatar_url ?? undefined,
    ownerAvatarVersion: row.owner_avatar_version ?? 0,
    verificationQuestion: row.verification_question ?? undefined,
    verificationAnswerHash: row.verification_answer_hash ?? undefined,
    photos: Array.isArray(row.photos) ? row.photos : [],
    expiresAt: row.expires_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

const SELECT_ITEM = `
  SELECT
    i.id, i.type, i.title, i.description, i.category, i.location_label, i.date_occurred, i.status,
    i.owner_id, i.verification_question, i.verification_answer_hash, i.expires_at, i.created_at, i.updated_at,
    u.name AS owner_name, u.avatar_url AS owner_avatar_url, u.avatar_version AS owner_avatar_version,
    COALESCE((
      SELECT json_agg(json_build_object('position', p.position, 'width', p.width, 'height', p.height) ORDER BY p.position)
      FROM item_images p WHERE p.item_id = i.id
    ), '[]'::json) AS photos
  FROM items i
  LEFT JOIN users u ON u.id = i.owner_id
`;

const ACTIVE = `i.status IN ('open', 'claim_pending') AND i.expires_at > NOW()`;

export interface BoardFilters {
  type?: string;
  category?: string;
  q?: string;
  location?: string;
  status?: 'active' | 'resolved';
}

export const Item = {
  /** Public board: active (or resolved) listings from everyone, filtered. */
  async findBoard(f: BoardFilters): Promise<IItem[]> {
    const conditions = [f.status === 'resolved' ? `i.status = 'resolved'` : ACTIVE];
    const values: unknown[] = [];
    const add = (sql: (n: number) => string, value: unknown) => {
      values.push(value);
      conditions.push(sql(values.length));
    };
    if (f.type === ItemType.LOST || f.type === ItemType.FOUND) add((n) => `i.type = $${n}`, f.type);
    if (f.category && (Object.values(ItemCategory) as string[]).includes(f.category)) add((n) => `i.category = $${n}`, f.category);
    if (f.location) add((n) => `i.location_label ILIKE $${n}`, `${escapeLike(f.location)}%`);
    if (f.q?.trim()) {
      add((n) => `(i.title ILIKE $${n} OR i.description ILIKE $${n} OR i.location_label ILIKE $${n})`, `%${escapeLike(f.q.trim())}%`);
    }
    const res = await query<ItemRow>(`${SELECT_ITEM} WHERE ${conditions.join(' AND ')} ORDER BY i.created_at DESC LIMIT 200`, values);
    return res.rows.map(toItem);
  },

  /** Everything a user has posted, in every status (profile history). */
  async findByOwner(ownerId: string, onlyActive = false): Promise<IItem[]> {
    const res = await query<ItemRow>(
      `${SELECT_ITEM} WHERE i.owner_id = $1 ${onlyActive ? `AND ${ACTIVE}` : `AND i.status <> 'removed'`} ORDER BY i.created_at DESC`,
      [ownerId],
    );
    return res.rows.map(toItem);
  },

  async findSaved(userId: string): Promise<IItem[]> {
    const res = await query<ItemRow>(
      `${SELECT_ITEM} JOIN user_saved_items s ON s.item_id = i.id AND s.user_id = $1
       WHERE i.status <> 'removed' ORDER BY s.created_at DESC`,
      [userId],
    );
    return res.rows.map(toItem);
  },

  async findById(id: string): Promise<IItem | null> {
    const res = await query<ItemRow>(`${SELECT_ITEM} WHERE i.id = $1`, [id]);
    return res.rows[0] ? toItem(res.rows[0]) : null;
  },

  async findByIdempotency(key: string, ownerId: string): Promise<IItem | null> {
    const res = await query<ItemRow>(`${SELECT_ITEM} WHERE i.idempotency_key = $1 AND i.owner_id = $2`, [key, ownerId]);
    return res.rows[0] ? toItem(res.rows[0]) : null;
  },

  /**
   * Possible matches: active listings of the opposite type in the same category,
   * ranked by how many title words they share, then by recency.
   */
  async findMatches(item: IItem, limit = 6): Promise<IItem[]> {
    const words = Array.from(new Set(item.title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [])).slice(0, 8);
    const opposite = item.type === ItemType.LOST ? ItemType.FOUND : ItemType.LOST;
    const res = await query<ItemRow & { score: number }>(
      `SELECT * FROM (
         ${SELECT_ITEM}
         WHERE ${ACTIVE} AND i.type = $1 AND i.category = $2 AND i.id <> $3 AND i.owner_id <> $4
       ) m
       ORDER BY (SELECT COUNT(*) FROM unnest($5::text[]) w WHERE m.title ILIKE '%' || w || '%') DESC, m.created_at DESC
       LIMIT $6`,
      [opposite, item.category, item.id, item.ownerId, words, limit],
    );
    return res.rows.map(toItem);
  },

  async create(data: {
    type: ItemType;
    title: string;
    description: string;
    category: ItemCategory;
    locationLabel: string;
    dateOccurred: Date;
    photos: ProcessedImage[];
    ownerId: string;
    verificationQuestion?: string;
    verificationAnswerHash?: string;
    idempotencyKey?: string;
  }): Promise<IItem> {
    const id = await withTransaction(async (client) => {
      const inserted = await client.query<{ id: string }>(
        `INSERT INTO items (type, title, description, category, location_label, date_occurred, owner_id,
                            verification_question, verification_answer_hash, idempotency_key)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
         ON CONFLICT (owner_id, idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          data.type,
          data.title,
          data.description,
          data.category,
          data.locationLabel,
          data.dateOccurred,
          data.ownerId,
          data.verificationQuestion || null,
          data.verificationAnswerHash || null,
          data.idempotencyKey || null,
        ],
      );
      if (!inserted.rows[0]) return null; // a concurrent duplicate submission won the race
      const itemId = inserted.rows[0].id;
      for (const [position, photo] of data.photos.entries()) {
        await client.query(
          `INSERT INTO item_images (item_id, position, mime, width, height, bytes, data, thumb)
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
          [itemId, position, photo.mime, photo.width, photo.height, photo.data.length, photo.data, photo.thumb],
        );
      }
      return itemId;
    });
    if (!id) {
      const existing = data.idempotencyKey ? await this.findByIdempotency(data.idempotencyKey, data.ownerId) : null;
      if (existing) return existing;
      throw new Error('Listing could not be created');
    }
    return (await this.findById(id))!;
  },

  async getPhoto(itemId: string, position: number, variant: 'full' | 'thumb'): Promise<{ mime: string; data: Buffer } | null> {
    const column = variant === 'thumb' ? 'thumb' : 'data';
    const res = await query<{ mime: string; data: Buffer }>(
      `SELECT mime, ${column} AS data FROM item_images WHERE item_id = $1 AND position = $2`,
      [itemId, position],
    );
    return res.rows[0] ?? null;
  },

  async updateStatus(id: string, status: ItemStatus): Promise<IItem | null> {
    await query('UPDATE items SET status = $1, updated_at = NOW() WHERE id = $2', [status, id]);
    return this.findById(id);
  },

  /** Owner renews an active listing for another 90 days. */
  async renew(id: string): Promise<IItem | null> {
    await query(
      `UPDATE items SET expires_at = NOW() + INTERVAL '90 days', updated_at = NOW()
       WHERE id = $1 AND status IN ('open', 'claim_pending')`,
      [id],
    );
    return this.findById(id);
  },

  async countByOwner(ownerId: string): Promise<{ lost: number; found: number; resolved: number; active: number }> {
    const res = await query<{ lost: string; found: string; resolved: string; active: string }>(
      `SELECT
         COUNT(*) FILTER (WHERE type = 'lost') AS lost,
         COUNT(*) FILTER (WHERE type = 'found') AS found,
         COUNT(*) FILTER (WHERE status = 'resolved') AS resolved,
         COUNT(*) FILTER (WHERE status IN ('open', 'claim_pending') AND expires_at > NOW()) AS active
       FROM items WHERE owner_id = $1 AND status <> 'removed'`,
      [ownerId],
    );
    const r = res.rows[0];
    return { lost: Number(r?.lost ?? 0), found: Number(r?.found ?? 0), resolved: Number(r?.resolved ?? 0), active: Number(r?.active ?? 0) };
  },
};

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (c) => `\\${c}`);
}
