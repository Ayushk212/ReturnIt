import { Router, Request, Response, NextFunction } from 'express';
import { CreateConversationSchema, ItemStatus, MessageContentSchema } from '@returnit/shared';
import { authenticate } from '../middleware/auth.js';
import { messageLimiter } from '../middleware/rateLimit.js';
import { asyncHandler } from '../utils/asyncHandler.js';
import { AppError } from '../utils/AppError.js';
import { uuidParam } from '../utils/http.js';
import { Item } from '../models/Item.js';
import { Claim } from '../models/Claim.js';
import { Conversation } from '../models/Conversation.js';
import { emitToUser } from '../realtime.js';
import { formatConversation, formatMessage } from './format.js';

const router = Router();
router.use(authenticate);

// GET /api/conversations — my inbox, most recent first
router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const list = await Conversation.listFor(req.user!.id);
    res.json({ conversations: list.map((c) => formatConversation(req, c, req.user!.id)) });
  }),
);

// POST /api/conversations — start (or reopen) a conversation about a listing
router.post(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = CreateConversationSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid request', 'VALIDATION_ERROR');
    const me = req.user!.id;
    const item = await Item.findById(parsed.data.itemId);
    if (!item || item.status === ItemStatus.REMOVED) throw AppError.notFound('This listing no longer exists');

    let other: string;
    if (item.ownerId === me) {
      // Owners can message people who have sent a request on their listing.
      const target = parsed.data.participantId;
      if (!target || target === me) throw AppError.badRequest('Choose who you want to message');
      if (!(await Claim.hasClaimed(item.id, target))) {
        throw AppError.forbidden('You can message members who have sent a request on this listing');
      }
      other = target;
    } else {
      other = item.ownerId;
    }

    const existingId = await Conversation.findOrCreate(item.id, me, other);
    const summary = await Conversation.getFor(existingId, me);
    res.status(201).json({ conversation: formatConversation(req, summary!, me) });
  }),
);

// Participant guard for /:id routes
type Summary = NonNullable<Awaited<ReturnType<typeof Conversation.getFor>>>;
const summaryOf = (res: Response): Summary => res.locals.summary as Summary;

async function participant(req: Request, res: Response, next: NextFunction): Promise<void> {
  try {
    const summary = await Conversation.getFor(String(req.params.id), req.user!.id);
    if (!summary) throw AppError.notFound('Conversation not found');
    res.locals.summary = summary;
    next();
  } catch (err) {
    next(err);
  }
}

router.get(
  '/:id',
  uuidParam('id', 'conversation'),
  participant,
  asyncHandler(async (req: Request, res: Response) => {
    res.json({ conversation: formatConversation(req, summaryOf(res), req.user!.id) });
  }),
);

// GET /api/conversations/:id/messages?before=ISO&after=ISO&limit=50
router.get(
  '/:id/messages',
  uuidParam('id', 'conversation'),
  participant,
  asyncHandler(async (req: Request, res: Response) => {
    const parseDate = (v: unknown) => {
      if (typeof v !== 'string' || !v) return undefined;
      const d = new Date(v);
      if (Number.isNaN(d.getTime())) throw AppError.badRequest('Invalid date cursor');
      return d;
    };
    const messages = await Conversation.messages(String(req.params.id), req.user!.id, {
      before: parseDate(req.query.before),
      after: parseDate(req.query.after),
      limit: Number(req.query.limit) || 50,
    });
    res.json({ messages: messages.map((m) => formatMessage(m, req.user!.id)) });
  }),
);

// POST /api/conversations/:id/messages
router.post(
  '/:id/messages',
  uuidParam('id', 'conversation'),
  participant,
  messageLimiter,
  asyncHandler(async (req: Request, res: Response) => {
    const parsed = MessageContentSchema.safeParse(req.body);
    if (!parsed.success) throw AppError.badRequest(parsed.error.errors[0]?.message ?? 'Invalid message', 'VALIDATION_ERROR');
    const me = req.user!.id;
    const conversationId = String(req.params.id);
    const { message, created } = await Conversation.send(conversationId, me, parsed.data.content, parsed.data.clientMessageId);
    if (created) {
      const otherId = summaryOf(res).counterpartId;
      emitToUser(otherId, 'message:new', { conversationId, message: formatMessage(message, otherId) });
      emitToUser(me, 'message:new', { conversationId, message: formatMessage(message, me) });
    }
    res.status(created ? 201 : 200).json({ message: formatMessage(message, me) });
  }),
);

// POST /api/conversations/:id/read — mark everything from the other person as read
router.post(
  '/:id/read',
  uuidParam('id', 'conversation'),
  participant,
  asyncHandler(async (req: Request, res: Response) => {
    const conversationId = String(req.params.id);
    const changed = await Conversation.markRead(conversationId, req.user!.id);
    if (changed > 0) emitToUser(summaryOf(res).counterpartId, 'conversation:read', { conversationId });
    emitToUser(req.user!.id, 'conversation:read', { conversationId });
    res.json({ ok: true });
  }),
);

export default router;
