import { query, withTransaction } from '../config/db.js';
import type { ItemStatus, ItemType } from '@returnit/shared';

export interface IConversationSummary {
  id: string;
  itemId: string;
  itemTitle: string;
  itemType: ItemType;
  itemStatus: ItemStatus;
  itemOwnerId: string;
  itemHasPhoto: boolean;
  counterpartId: string;
  counterpartName: string;
  counterpartAvatarUrl?: string;
  counterpartAvatarVersion: number;
  lastMessage?: { content: string; senderId: string; createdAt: Date };
  unreadCount: number;
  lastMessageAt: Date;
  createdAt: Date;
}

export interface IMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientMessageId: string;
  readByCounterpart: boolean;
  createdAt: Date;
}

interface SummaryRow {
  id: string;
  item_id: string;
  item_title: string;
  item_type: string;
  item_status: string;
  item_owner_id: string;
  item_has_photo: boolean;
  counterpart_id: string;
  counterpart_name: string;
  counterpart_avatar_url: string | null;
  counterpart_avatar_version: number | null;
  last_content: string | null;
  last_sender_id: string | null;
  last_created_at: Date | null;
  unread_count: string;
  last_message_at: Date;
  created_at: Date;
}

interface MessageRow {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  client_message_id: string;
  read_by: string[] | null;
  created_at: Date;
}

const SUMMARY = `
  SELECT c.id, c.item_id, c.last_message_at, c.created_at,
         i.title AS item_title, i.type AS item_type, i.status AS item_status, i.owner_id AS item_owner_id,
         EXISTS (SELECT 1 FROM item_images p WHERE p.item_id = i.id) AS item_has_photo,
         o.id AS counterpart_id, o.name AS counterpart_name,
         o.avatar_url AS counterpart_avatar_url, o.avatar_version AS counterpart_avatar_version,
         lm.content AS last_content, lm.sender_id AS last_sender_id, lm.created_at AS last_created_at,
         (SELECT COUNT(*) FROM messages m
           WHERE m.conversation_id = c.id AND m.sender_id <> $1 AND NOT ($1 = ANY(COALESCE(m.read_by, '{}')))) AS unread_count
  FROM conversations c
  JOIN items i ON i.id = c.item_id
  JOIN users o ON o.id = CASE WHEN c.participant_one = $1 THEN c.participant_two ELSE c.participant_one END
  LEFT JOIN LATERAL (
    SELECT content, sender_id, created_at FROM messages WHERE conversation_id = c.id ORDER BY created_at DESC LIMIT 1
  ) lm ON TRUE
  WHERE (c.participant_one = $1 OR c.participant_two = $1)
`;

function toSummary(r: SummaryRow): IConversationSummary {
  return {
    id: r.id,
    itemId: r.item_id,
    itemTitle: r.item_title,
    itemType: r.item_type as ItemType,
    itemStatus: r.item_status as ItemStatus,
    itemOwnerId: r.item_owner_id,
    itemHasPhoto: r.item_has_photo,
    counterpartId: r.counterpart_id,
    counterpartName: r.counterpart_name,
    counterpartAvatarUrl: r.counterpart_avatar_url ?? undefined,
    counterpartAvatarVersion: r.counterpart_avatar_version ?? 0,
    lastMessage: r.last_content && r.last_sender_id && r.last_created_at
      ? { content: r.last_content, senderId: r.last_sender_id, createdAt: r.last_created_at }
      : undefined,
    unreadCount: Number(r.unread_count),
    lastMessageAt: r.last_message_at,
    createdAt: r.created_at,
  };
}

function toMessage(r: MessageRow, viewerId: string): IMessage {
  const readers = r.read_by ?? [];
  return {
    id: r.id,
    conversationId: r.conversation_id,
    senderId: r.sender_id,
    content: r.content,
    clientMessageId: r.client_message_id,
    // For my own messages: has the other person read it?
    readByCounterpart: r.sender_id === viewerId ? readers.some((u) => u !== viewerId) : true,
    createdAt: r.created_at,
  };
}

export const Conversation = {
  /** Get or create the single conversation between two users about one listing. */
  async findOrCreate(itemId: string, userA: string, userB: string): Promise<string> {
    const [one, two] = userA < userB ? [userA, userB] : [userB, userA];
    const res = await query<{ id: string }>(
      `INSERT INTO conversations (item_id, participant_one, participant_two) VALUES ($1, $2, $3)
       ON CONFLICT (item_id, participant_one, participant_two) DO UPDATE SET updated_at = conversations.updated_at
       RETURNING id`,
      [itemId, one, two],
    );
    return res.rows[0].id;
  },

  async listFor(userId: string): Promise<IConversationSummary[]> {
    const res = await query<SummaryRow>(`${SUMMARY} ORDER BY c.last_message_at DESC LIMIT 200`, [userId]);
    return res.rows.map(toSummary);
  },

  /** Returns the summary only when `userId` is a participant. */
  async getFor(conversationId: string, userId: string): Promise<IConversationSummary | null> {
    const res = await query<SummaryRow>(`${SUMMARY} AND c.id = $2`, [userId, conversationId]);
    return res.rows[0] ? toSummary(res.rows[0]) : null;
  },

  async participants(conversationId: string): Promise<[string, string] | null> {
    const res = await query<{ participant_one: string; participant_two: string }>(
      'SELECT participant_one, participant_two FROM conversations WHERE id = $1',
      [conversationId],
    );
    const r = res.rows[0];
    return r ? [r.participant_one, r.participant_two] : null;
  },

  async messages(conversationId: string, viewerId: string, opts: { before?: Date; after?: Date; limit?: number } = {}): Promise<IMessage[]> {
    const limit = Math.min(Math.max(opts.limit ?? 50, 1), 100);
    const values: unknown[] = [conversationId];
    let where = 'conversation_id = $1';
    if (opts.before) {
      values.push(opts.before);
      where += ` AND created_at < $${values.length}`;
    }
    if (opts.after) {
      values.push(opts.after);
      where += ` AND created_at > $${values.length}`;
    }
    values.push(limit);
    const res = await query<MessageRow>(
      `SELECT * FROM (SELECT * FROM messages WHERE ${where} ORDER BY created_at DESC LIMIT $${values.length}) recent
       ORDER BY created_at ASC`,
      values,
    );
    return res.rows.map((r) => toMessage(r, viewerId));
  },

  /** Idempotent send: retrying with the same clientMessageId returns the original message. */
  async send(conversationId: string, senderId: string, content: string, clientMessageId: string): Promise<{ message: IMessage; created: boolean }> {
    return withTransaction(async (client) => {
      const inserted = await client.query<MessageRow>(
        `INSERT INTO messages (conversation_id, sender_id, content, client_message_id, read_by)
         VALUES ($1, $2, $3, $4, ARRAY[$2]::uuid[])
         ON CONFLICT (client_message_id, sender_id) DO NOTHING
         RETURNING *`,
        [conversationId, senderId, content, clientMessageId],
      );
      if (inserted.rows[0]) {
        await client.query('UPDATE conversations SET last_message_at = NOW(), updated_at = NOW() WHERE id = $1', [conversationId]);
        return { message: toMessage(inserted.rows[0], senderId), created: true };
      }
      const existing = await client.query<MessageRow>(
        'SELECT * FROM messages WHERE client_message_id = $1 AND sender_id = $2',
        [clientMessageId, senderId],
      );
      return { message: toMessage(existing.rows[0], senderId), created: false };
    });
  },

  async markRead(conversationId: string, userId: string): Promise<number> {
    const res = await query(
      `UPDATE messages SET read_by = array_append(COALESCE(read_by, '{}'), $2::uuid)
       WHERE conversation_id = $1 AND sender_id <> $2 AND NOT ($2 = ANY(COALESCE(read_by, '{}')))`,
      [conversationId, userId],
    );
    return res.rowCount ?? 0;
  },

  async unreadTotal(userId: string): Promise<number> {
    const res = await query<{ n: string }>(
      `SELECT COUNT(*) AS n FROM messages m JOIN conversations c ON c.id = m.conversation_id
       WHERE (c.participant_one = $1 OR c.participant_two = $1)
         AND m.sender_id <> $1 AND NOT ($1 = ANY(COALESCE(m.read_by, '{}')))`,
      [userId],
    );
    return Number(res.rows[0]?.n ?? 0);
  },
};
