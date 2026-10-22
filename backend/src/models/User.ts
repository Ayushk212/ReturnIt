import { query } from '../config/db.js';
import { UserRole, UserStatus } from '@returnit/shared';

export interface IUser {
  _id: string;
  id: string;
  name: string;
  email: string;
  phone?: string;
  bio: string;
  /** External photo (e.g. from Google). Uploaded photos are served from /users/:id/avatar. */
  avatarUrl?: string;
  avatarVersion: number;
  programme?: string;
  academicYear?: string;
  branch?: string;
  section?: string;
  onboarded: boolean;
  role: UserRole;
  status: UserStatus;
  trustScore: number;
  createdAt: Date;
  updatedAt: Date;
}

export interface UserRow {
  id: string;
  email: string;
  name: string;
  phone: string | null;
  bio: string | null;
  avatar_url: string | null;
  avatar_version: number | null;
  programme: string | null;
  academic_year: string | null;
  branch: string | null;
  section: string | null;
  onboarded_at: Date | null;
  role: string;
  status: string;
  trust_score: number;
  created_at: Date;
  updated_at: Date;
}

export function toUser(row: UserRow): IUser {
  return {
    _id: row.id,
    id: row.id,
    name: row.name,
    email: row.email,
    phone: row.phone ?? undefined,
    bio: row.bio ?? '',
    avatarUrl: row.avatar_url ?? undefined,
    avatarVersion: row.avatar_version ?? 0,
    programme: row.programme ?? undefined,
    academicYear: row.academic_year ?? undefined,
    branch: row.branch ?? undefined,
    section: row.section ?? undefined,
    onboarded: Boolean(row.onboarded_at),
    role: (row.role as UserRole) || UserRole.USER,
    status: (row.status as UserStatus) || UserStatus.ACTIVE,
    trustScore: row.trust_score ?? 10,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export interface ProfileUpdate {
  name?: string;
  bio?: string;
  programme?: string;
  academicYear?: string;
  branch?: string;
  section?: string;
  markOnboarded?: boolean;
}

export const User = {
  async findById(id: string): Promise<IUser | null> {
    const res = await query<UserRow>('SELECT * FROM users WHERE id = $1', [id]);
    return res.rows[0] ? toUser(res.rows[0]) : null;
  },

  async findByEmail(email: string): Promise<IUser | null> {
    const res = await query<UserRow>('SELECT * FROM users WHERE LOWER(email) = $1', [email.trim().toLowerCase()]);
    return res.rows[0] ? toUser(res.rows[0]) : null;
  },

  async upsertFromAuth(data: { id: string; email: string; name: string; avatarUrl?: string | null }): Promise<IUser> {
    const cleanEmail = data.email.trim().toLowerCase();
    const cleanName = data.name.trim() || cleanEmail.split('@')[0] || 'Member';
    const res = await query<UserRow>(
      `INSERT INTO users (id, email, name, avatar_url)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO UPDATE SET
         email = EXCLUDED.email,
         name = CASE WHEN users.name IS NULL OR users.name = '' OR users.name = 'Member' THEN EXCLUDED.name ELSE users.name END,
         avatar_url = COALESCE(users.avatar_url, EXCLUDED.avatar_url),
         updated_at = NOW()
       RETURNING *`,
      [data.id, cleanEmail, cleanName, data.avatarUrl || null],
    );
    return toUser(res.rows[0]);
  },

  async updateProfile(id: string, updates: ProfileUpdate): Promise<IUser | null> {
    const columns: Record<string, string | undefined> = {
      name: updates.name,
      bio: updates.bio,
      programme: updates.programme,
      academic_year: updates.academicYear,
      branch: updates.branch,
      section: updates.section === undefined ? undefined : updates.section.toUpperCase(),
    };
    const sets: string[] = [];
    const values: unknown[] = [];
    for (const [column, value] of Object.entries(columns)) {
      if (value === undefined) continue;
      values.push(value.trim() === '' && column !== 'bio' ? null : value.trim());
      sets.push(`${column} = $${values.length}`);
    }
    if (updates.markOnboarded) sets.push('onboarded_at = COALESCE(onboarded_at, NOW())');
    if (sets.length === 0) return this.findById(id);
    values.push(id);
    const res = await query<UserRow>(
      `UPDATE users SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${values.length} RETURNING *`,
      values,
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  },

  async setAvatar(id: string, mime: string, data: Buffer): Promise<IUser | null> {
    await query(
      `INSERT INTO user_avatars (user_id, mime, data, bytes, updated_at) VALUES ($1, $2, $3, $4, NOW())
       ON CONFLICT (user_id) DO UPDATE SET mime = EXCLUDED.mime, data = EXCLUDED.data, bytes = EXCLUDED.bytes, updated_at = NOW()`,
      [id, mime, data, data.length],
    );
    const res = await query<UserRow>(
      'UPDATE users SET avatar_version = avatar_version + 1, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id],
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  },

  async removeAvatar(id: string): Promise<IUser | null> {
    await query('DELETE FROM user_avatars WHERE user_id = $1', [id]);
    const res = await query<UserRow>(
      'UPDATE users SET avatar_version = 0, avatar_url = NULL, updated_at = NOW() WHERE id = $1 RETURNING *',
      [id],
    );
    return res.rows[0] ? toUser(res.rows[0]) : null;
  },

  async getAvatar(id: string): Promise<{ mime: string; data: Buffer; updatedAt: Date } | null> {
    const res = await query<{ mime: string; data: Buffer; updated_at: Date }>(
      'SELECT mime, data, updated_at FROM user_avatars WHERE user_id = $1',
      [id],
    );
    const row = res.rows[0];
    return row ? { mime: row.mime, data: row.data, updatedAt: row.updated_at } : null;
  },

  async anonymize(id: string, randomizedSuffix: string): Promise<void> {
    await query('DELETE FROM user_avatars WHERE user_id = $1', [id]);
    await query(
      `UPDATE users SET
         name = 'Anonymous User', email = $2, phone = NULL, bio = '', avatar_url = NULL, avatar_version = 0,
         programme = NULL, academic_year = NULL, branch = NULL, section = NULL, updated_at = NOW()
       WHERE id = $1`,
      [id, `deleted-${id}-${randomizedSuffix}@returnit.local`],
    );
  },

  /** Toggle a bookmark atomically. Returns the new saved state. */
  async toggleSaved(userId: string, itemId: string): Promise<boolean> {
    const removed = await query('DELETE FROM user_saved_items WHERE user_id = $1 AND item_id = $2', [userId, itemId]);
    if ((removed.rowCount ?? 0) > 0) return false;
    await query('INSERT INTO user_saved_items (user_id, item_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [userId, itemId]);
    return true;
  },

  async getSavedItemIds(userId: string): Promise<Set<string>> {
    const res = await query<{ item_id: string }>('SELECT item_id FROM user_saved_items WHERE user_id = $1', [userId]);
    return new Set(res.rows.map((r) => r.item_id));
  },
};
