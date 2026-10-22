import type { Request } from 'express';
import { ClaimStatus, formatAcademicLine } from '@returnit/shared';
import type { IItem } from '../models/Item.js';
import type { IClaim } from '../models/Claim.js';
import type { IUser } from '../models/User.js';
import type { IConversationSummary, IMessage } from '../models/Conversation.js';
import { apiBase } from '../utils/http.js';

/**
 * Response shapes. Every outgoing object is built here so private fields
 * (emails, phone numbers, verification answer hashes) can never leak through a raw row.
 */

const iso = (d: Date | string) => (d instanceof Date ? d : new Date(d)).toISOString();

export function avatarUrlFor(req: Request, user: { id: string; avatarVersion: number; avatarUrl?: string }): string | undefined {
  if (user.avatarVersion > 0) return `${apiBase(req)}/users/${user.id}/avatar?v=${user.avatarVersion}`;
  return user.avatarUrl || undefined;
}

export function formatItem(
  req: Request,
  item: IItem,
  viewer?: { id: string; saved?: Set<string>; claims?: Map<string, ClaimStatus> },
) {
  const base = apiBase(req);
  return {
    id: item.id,
    type: item.type,
    title: item.title,
    description: item.description,
    category: item.category,
    locationLabel: item.locationLabel,
    dateOccurred: iso(item.dateOccurred),
    createdAt: iso(item.createdAt),
    expiresAt: iso(item.expiresAt),
    status: item.status,
    images: item.photos.map((p, n) => ({
      url: `${base}/items/${item.id}/photos/${p.position}`,
      thumbUrl: `${base}/items/${item.id}/photos/${p.position}?size=thumb`,
      alt: `${item.title} (photo ${n + 1})`,
      width: p.width,
      height: p.height,
    })),
    owner: {
      id: item.ownerId,
      name: item.ownerName,
      avatarUrl: avatarUrlFor(req, { id: item.ownerId, avatarVersion: item.ownerAvatarVersion, avatarUrl: item.ownerAvatarUrl }),
    },
    isOwner: viewer?.id === item.ownerId,
    saved: Boolean(viewer?.saved?.has(item.id)),
    verificationQuestion: item.verificationQuestion || undefined,
    myClaimStatus: viewer?.claims?.get(item.id),
  };
}

export function formatClaim(claim: IClaim, viewerId: string) {
  const received = claim.itemOwnerId === viewerId;
  const approved = claim.status === ClaimStatus.APPROVED;
  return {
    id: claim.id,
    itemId: claim.itemId,
    itemTitle: claim.itemTitle,
    itemType: claim.itemType,
    direction: received ? ('received' as const) : ('sent' as const),
    counterpartId: received ? claim.claimantId : claim.itemOwnerId,
    counterpartName: received ? claim.claimantName : claim.itemOwnerName,
    message: claim.answers,
    status: claim.status,
    createdAt: iso(claim.createdAt),
    // Contact details are revealed only after the owner approves, and only to the two people involved.
    contact: approved
      ? received
        ? { name: claim.claimantName, email: claim.claimantEmail }
        : { name: claim.itemOwnerName, email: claim.itemOwnerEmail }
      : undefined,
  };
}

function academic(user: IUser) {
  return {
    programme: user.programme ?? null,
    academicYear: user.academicYear ?? null,
    branch: user.branch ?? null,
    section: user.section ?? null,
    summary: formatAcademicLine(user),
  };
}

/** The signed-in user's own profile (includes email). */
export function formatMe(req: Request, user: IUser, stats?: { lost: number; found: number; resolved: number; active: number }) {
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    bio: user.bio,
    avatarUrl: avatarUrlFor(req, user),
    hasUploadedAvatar: user.avatarVersion > 0,
    academic: academic(user),
    onboarded: user.onboarded,
    createdAt: iso(user.createdAt),
    stats,
  };
}

/** What other members can see. Never includes email or phone. */
export function formatPublicUser(req: Request, user: IUser, stats: { lost: number; found: number; resolved: number; active: number }) {
  return {
    id: user.id,
    name: user.name,
    bio: user.bio,
    avatarUrl: avatarUrlFor(req, user),
    academic: academic(user),
    createdAt: iso(user.createdAt),
    stats,
  };
}

export function formatConversation(req: Request, c: IConversationSummary, viewerId: string) {
  const base = apiBase(req);
  return {
    id: c.id,
    item: {
      id: c.itemId,
      title: c.itemTitle,
      type: c.itemType,
      status: c.itemStatus,
      thumbUrl: c.itemHasPhoto ? `${base}/items/${c.itemId}/photos/0?size=thumb` : undefined,
      isMine: c.itemOwnerId === viewerId,
    },
    counterpart: {
      id: c.counterpartId,
      name: c.counterpartName,
      avatarUrl: avatarUrlFor(req, { id: c.counterpartId, avatarVersion: c.counterpartAvatarVersion, avatarUrl: c.counterpartAvatarUrl }),
    },
    lastMessage: c.lastMessage
      ? { content: c.lastMessage.content, fromMe: c.lastMessage.senderId === viewerId, createdAt: iso(c.lastMessage.createdAt) }
      : undefined,
    unreadCount: c.unreadCount,
    updatedAt: iso(c.lastMessageAt),
  };
}

export function formatMessage(m: IMessage, viewerId: string) {
  return {
    id: m.id,
    conversationId: m.conversationId,
    fromMe: m.senderId === viewerId,
    senderId: m.senderId,
    content: m.content,
    clientMessageId: m.clientMessageId,
    read: m.readByCounterpart,
    createdAt: iso(m.createdAt),
  };
}
