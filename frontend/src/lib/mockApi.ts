import type { Api } from './api';
import { ApiError } from './apiError';
import { compressImage } from './imageCompression';
import { seedItems, type StoredItem } from './mockData';
import { composeBio, formatAcademicLine } from './profile';
import { session } from './session';
import type { ChatMessage, Claim, ClaimStatus, Conversation, Item, ListingStats, MyProfile, PublicProfile } from './types';

/* ------------------------------------------------------------------ */
/* Demo implementation (VITE_USE_MOCK=true). Data lives in            */
/* localStorage. Listing photos use temporary object URLs.            */
/* ------------------------------------------------------------------ */

interface StoredClaim {
  id: string;
  itemId: string;
  claimantId: string;
  claimantName: string;
  claimantEmail: string;
  message: string;
  status: ClaimStatus;
  createdAt: string;
}

interface StoredProfile {
  name: string;
  email: string;
  bio: string;
  avatarDataUrl?: string;
  programme: string | null;
  academicYear: string | null;
  branch: string | null;
  section: string | null;
  onboarded: boolean;
  createdAt: string;
}

interface StoredConversation {
  id: string;
  itemId: string;
  members: [string, string];
  lastAt: string;
}

interface StoredMessage {
  id: string;
  conversationId: string;
  senderId: string;
  content: string;
  clientMessageId: string;
  readBy: string[];
  createdAt: string;
}

interface Store {
  items: StoredItem[];
  saved: string[];
  claims: StoredClaim[];
  keys: Record<string, string>;
  profiles: Record<string, StoredProfile>;
  conversations: StoredConversation[];
  messages: StoredMessage[];
  reports: string[];
}

const STORE_KEY = 'returnit.mock.v3';
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function persist(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage full or unavailable: demo state is simply not persisted */
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to a fresh store */
  }
  const fresh: Store = { items: seedItems(), saved: [], claims: [], keys: {}, profiles: {}, conversations: [], messages: [], reports: [] };
  persist(fresh);
  return fresh;
}

function me(): { uid: string; name: string; email: string } {
  const user = session.user;
  if (!user) throw new ApiError(401, 'Please sign in to continue.');
  return user;
}

function profileOf(store: Store, uid: string): StoredProfile {
  let p = store.profiles[uid];
  if (!p) {
    const user = session.user?.uid === uid ? session.user : null;
    const seedName = store.items.find((i) => i.ownerId === uid)?.owner.name;
    p = {
      name: user?.name ?? seedName ?? 'Member',
      email: user?.email ?? '',
      bio: '',
      programme: null,
      academicYear: null,
      branch: null,
      section: null,
      onboarded: !user, // seeded demo owners are treated as complete profiles
      createdAt: new Date().toISOString(),
    };
    store.profiles[uid] = p;
  }
  return p;
}

function stats(store: Store, uid: string): ListingStats {
  const mine = store.items.filter((i) => i.ownerId === uid);
  return {
    lost: mine.filter((i) => i.type === 'lost').length,
    found: mine.filter((i) => i.type === 'found').length,
    resolved: mine.filter((i) => i.status === 'resolved').length,
    active: mine.filter((i) => i.status === 'open' || i.status === 'claim_pending').length,
  };
}

function academic(p: StoredProfile) {
  return { programme: p.programme, academicYear: p.academicYear, branch: p.branch, section: p.section, summary: formatAcademicLine(p) };
}

function toMe(store: Store, uid: string): MyProfile {
  const p = profileOf(store, uid);
  return {
    id: uid,
    name: p.name,
    email: p.email,
    bio: p.bio,
    avatarUrl: p.avatarDataUrl,
    hasUploadedAvatar: Boolean(p.avatarDataUrl),
    academic: academic(p),
    onboarded: p.onboarded,
    createdAt: p.createdAt,
    stats: stats(store, uid),
  };
}

function toItem(item: StoredItem, store: Store): Item {
  const uid = session.user?.uid;
  const { ownerId, ...rest } = item;
  const latest = uid ? [...store.claims].reverse().find((c) => c.itemId === item.id && c.claimantId === uid) : undefined;
  const owner = store.profiles[ownerId];
  return {
    ...rest,
    owner: { id: ownerId, name: owner?.name ?? item.owner.name, avatarUrl: owner?.avatarDataUrl },
    isOwner: uid === ownerId,
    saved: store.saved.includes(item.id),
    myClaimStatus: latest?.status,
  };
}

function toClaim(c: StoredClaim, store: Store): Claim {
  const uid = me().uid;
  const item = store.items.find((i) => i.id === c.itemId);
  const received = item?.ownerId === uid;
  const ownerName = item ? profileOf(store, item.ownerId).name : 'Owner';
  return {
    id: c.id,
    itemId: c.itemId,
    itemTitle: item?.title ?? 'Removed listing',
    itemType: item?.type ?? 'found',
    direction: received ? 'received' : 'sent',
    counterpartId: received ? c.claimantId : item?.ownerId,
    counterpartName: received ? c.claimantName : ownerName,
    message: c.message,
    status: c.status,
    createdAt: c.createdAt,
    contact:
      c.status === 'approved'
        ? { name: received ? c.claimantName : ownerName, email: received ? c.claimantEmail : profileOf(store, item?.ownerId ?? '').email || 'demo.owner@mnnit.ac.in' }
        : undefined,
  };
}

function toConversation(c: StoredConversation, store: Store, uid: string): Conversation {
  const item = store.items.find((i) => i.id === c.itemId);
  const otherId = c.members[0] === uid ? c.members[1] : c.members[0];
  const other = profileOf(store, otherId);
  const msgs = store.messages.filter((m) => m.conversationId === c.id);
  const last = msgs[msgs.length - 1];
  return {
    id: c.id,
    item: {
      id: c.itemId,
      title: item?.title ?? 'Removed listing',
      type: item?.type ?? 'found',
      status: item?.status ?? 'resolved',
      thumbUrl: item?.images[0]?.url,
      isMine: item?.ownerId === uid,
    },
    counterpart: { id: otherId, name: other.name, avatarUrl: other.avatarDataUrl },
    lastMessage: last ? { content: last.content, fromMe: last.senderId === uid, createdAt: last.createdAt } : undefined,
    unreadCount: msgs.filter((m) => m.senderId !== uid && !m.readBy.includes(uid)).length,
    updatedAt: c.lastAt,
  };
}

function toMessage(m: StoredMessage, uid: string): ChatMessage {
  return {
    id: m.id,
    conversationId: m.conversationId,
    fromMe: m.senderId === uid,
    content: m.content,
    clientMessageId: m.clientMessageId,
    read: m.senderId === uid ? m.readBy.some((r) => r !== uid) : true,
    createdAt: m.createdAt,
  };
}

function conversationFor(store: Store, id: string, uid: string): StoredConversation {
  const c = store.conversations.find((x) => x.id === id && x.members.includes(uid));
  if (!c) throw new ApiError(404, 'Conversation not found');
  return c;
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new ApiError(400, 'Could not read this photo.'));
    reader.readAsDataURL(file);
  });
}

export const mockApi: Api = {
  async listItems(f) {
    await sleep(250);
    const store = load();
    const q = f.q?.trim().toLowerCase();
    const wantResolved = f.status === 'resolved';
    return store.items
      .filter((i) => (wantResolved ? i.status === 'resolved' : i.status === 'open' || i.status === 'claim_pending'))
      .filter((i) => !f.type || i.type === f.type)
      .filter((i) => !f.category || i.category === f.category)
      .filter((i) => !f.location || i.locationLabel.startsWith(f.location))
      .filter((i) => !q || `${i.title} ${i.description} ${i.locationLabel}`.toLowerCase().includes(q))
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((i) => toItem(i, store));
  },

  async getItem(id) {
    await sleep(150);
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    return toItem(item, store);
  },

  async getMatches(id) {
    await sleep(150);
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    const words = item.title.toLowerCase().match(/[a-z0-9]{3,}/g) ?? [];
    return store.items
      .filter((i) => i.id !== id && i.ownerId !== item.ownerId && i.type !== item.type && i.category === item.category)
      .filter((i) => i.status === 'open' || i.status === 'claim_pending')
      .map((i) => ({ i, score: words.filter((w) => i.title.toLowerCase().includes(w)).length }))
      .sort((a, b) => b.score - a.score || b.i.createdAt.localeCompare(a.i.createdAt))
      .slice(0, 6)
      .map(({ i }) => toItem(i, store));
  },

  async createItem(input) {
    await sleep(400);
    const store = load();
    const user = me();
    const existingId = store.keys[input.idempotencyKey];
    const existing = existingId ? store.items.find((i) => i.id === existingId) : undefined;
    if (existing) return toItem(existing, store);
    profileOf(store, user.uid);
    const item: StoredItem = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      locationLabel: input.locationLabel,
      dateOccurred: input.dateOccurred,
      createdAt: new Date().toISOString(),
      expiresAt: new Date(Date.now() + 90 * 86_400_000).toISOString(),
      status: 'open',
      images: input.images.map((file, index) => ({ url: URL.createObjectURL(file), alt: `${input.title} (photo ${index + 1})` })),
      owner: { id: user.uid, name: user.name },
      ownerId: user.uid,
      isOwner: true,
      saved: false,
      verificationQuestion: input.verificationQuestion,
    };
    store.items.unshift(item);
    store.keys[input.idempotencyKey] = item.id;
    persist(store);
    return toItem(item, store);
  },

  async toggleSave(id) {
    await sleep(100);
    me();
    const store = load();
    const on = !store.saved.includes(id);
    store.saved = on ? [...store.saved, id] : store.saved.filter((x) => x !== id);
    persist(store);
    return on;
  },

  async listMine() {
    await sleep(200);
    const { uid } = me();
    const store = load();
    return store.items.filter((i) => i.ownerId === uid).map((i) => toItem(i, store));
  },

  async listSaved() {
    await sleep(200);
    me();
    const store = load();
    return store.items.filter((i) => store.saved.includes(i.id)).map((i) => toItem(i, store));
  },

  async listClaims() {
    await sleep(200);
    const { uid } = me();
    const store = load();
    return store.claims
      .filter((c) => c.claimantId === uid || store.items.find((i) => i.id === c.itemId)?.ownerId === uid)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => toClaim(c, store));
  },

  async submitClaim(itemId, message) {
    await sleep(300);
    const user = me();
    const store = load();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    if (item.ownerId === user.uid) throw new ApiError(403, 'You cannot send a request on your own listing.');
    if (item.status === 'resolved' || item.status === 'expired') throw new ApiError(409, 'This listing is closed.');
    const active = store.claims.some((c) => c.itemId === itemId && c.claimantId === user.uid && (c.status === 'pending' || c.status === 'approved'));
    if (active) throw new ApiError(409, 'You already have a request on this listing.');
    const claim: StoredClaim = {
      id: crypto.randomUUID(),
      itemId,
      claimantId: user.uid,
      claimantName: profileOf(store, user.uid).name,
      claimantEmail: user.email,
      message,
      status: 'pending',
      createdAt: new Date().toISOString(),
    };
    store.claims.push(claim);
    item.status = 'claim_pending';
    persist(store);
    return toClaim(claim, store);
  },

  async decideClaim(claimId, decision) {
    await sleep(250);
    const { uid } = me();
    const store = load();
    const claim = store.claims.find((c) => c.id === claimId);
    const item = claim ? store.items.find((i) => i.id === claim.itemId) : undefined;
    if (!claim || !item) throw new ApiError(404, 'Request not found.');
    if (claim.status !== 'pending') throw new ApiError(409, 'This request has already been handled.');
    if (decision === 'withdraw') {
      if (claim.claimantId !== uid) throw new ApiError(403, 'Only the requester can withdraw a request.');
      claim.status = 'withdrawn';
    } else {
      if (item.ownerId !== uid) throw new ApiError(403, 'Only the listing owner can do this.');
      if (decision === 'approve') {
        claim.status = 'approved';
        item.status = 'resolved';
        store.claims.forEach((other) => {
          if (other.itemId === item.id && other.id !== claim.id && other.status === 'pending') other.status = 'rejected';
        });
      } else {
        claim.status = 'rejected';
      }
    }
    if (item.status === 'claim_pending' && !store.claims.some((c) => c.itemId === item.id && c.status === 'pending')) item.status = 'open';
    persist(store);
    return toClaim(claim, store);
  },

  async resolveItem(id) {
    await sleep(250);
    const { uid } = me();
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    if (item.ownerId !== uid) throw new ApiError(403, 'Only the listing owner can do this.');
    item.status = 'resolved';
    persist(store);
    return toItem(item, store);
  },

  async renewItem(id) {
    await sleep(250);
    const { uid } = me();
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    if (item.ownerId !== uid) throw new ApiError(403, 'Only the listing owner can do this.');
    item.expiresAt = new Date(Date.now() + 90 * 86_400_000).toISOString();
    persist(store);
    return toItem(item, store);
  },

  async reportItem(id) {
    await sleep(250);
    const { uid } = me();
    const store = load();
    const key = `${uid}:${id}`;
    const alreadyReported = store.reports.includes(key);
    if (!alreadyReported) store.reports.push(key);
    persist(store);
    return { alreadyReported };
  },

  async getMe() {
    await sleep(120);
    const { uid } = me();
    const store = load();
    const result = toMe(store, uid);
    persist(store);
    return result;
  },

  async completeOnboarding(input) {
    await sleep(300);
    const { uid } = me();
    const store = load();
    const p = profileOf(store, uid);
    Object.assign(p, {
      name: input.name.trim(),
      programme: input.programme,
      academicYear: input.academicYear,
      branch: input.branch,
      section: input.section.trim().toUpperCase() || null,
      bio: composeBio(input),
      onboarded: true,
    });
    persist(store);
    return toMe(store, uid);
  },

  async updateProfile(update) {
    await sleep(250);
    const { uid } = me();
    const store = load();
    const p = profileOf(store, uid);
    if (update.name !== undefined) p.name = update.name.trim();
    if (update.programme !== undefined) p.programme = update.programme;
    if (update.academicYear !== undefined) p.academicYear = update.academicYear;
    if (update.branch !== undefined) p.branch = update.branch;
    if (update.section !== undefined) p.section = update.section.trim().toUpperCase() || null;
    if (update.bio !== undefined) p.bio = update.bio.trim();
    persist(store);
    return toMe(store, uid);
  },

  async uploadAvatar(file) {
    const { uid } = me();
    const small = await compressImage(file, { maxEdge: 320, quality: 0.82, skipBelowBytes: 0 });
    const store = load();
    profileOf(store, uid).avatarDataUrl = await readAsDataUrl(small.file);
    persist(store);
    return toMe(store, uid);
  },

  async removeAvatar() {
    await sleep(150);
    const { uid } = me();
    const store = load();
    delete profileOf(store, uid).avatarDataUrl;
    persist(store);
    return toMe(store, uid);
  },

  async getPublicProfile(id): Promise<PublicProfile> {
    await sleep(150);
    const store = load();
    const known = store.profiles[id] || store.items.some((i) => i.ownerId === id);
    if (!known) throw new ApiError(404, 'This member could not be found');
    const p = profileOf(store, id);
    return { id, name: p.name, bio: p.bio, avatarUrl: p.avatarDataUrl, academic: academic(p), createdAt: p.createdAt, stats: stats(store, id) };
  },

  async listUserListings(id) {
    await sleep(150);
    const store = load();
    return store.items.filter((i) => i.ownerId === id && (i.status === 'open' || i.status === 'claim_pending')).map((i) => toItem(i, store));
  },

  async getSummary() {
    const uid = session.user?.uid;
    if (!uid) return { unreadMessages: 0, pendingRequests: 0 };
    const store = load();
    const unreadMessages = store.messages.filter((m) => {
      const c = store.conversations.find((x) => x.id === m.conversationId);
      return c?.members.includes(uid) && m.senderId !== uid && !m.readBy.includes(uid);
    }).length;
    const pendingRequests = store.claims.filter((c) => c.status === 'pending' && store.items.find((i) => i.id === c.itemId)?.ownerId === uid).length;
    return { unreadMessages, pendingRequests };
  },

  async listConversations() {
    await sleep(150);
    const { uid } = me();
    const store = load();
    return store.conversations
      .filter((c) => c.members.includes(uid))
      .sort((a, b) => b.lastAt.localeCompare(a.lastAt))
      .map((c) => toConversation(c, store, uid));
  },

  async startConversation(itemId, participantId) {
    await sleep(200);
    const { uid } = me();
    const store = load();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError(404, 'This listing no longer exists');
    let other = item.ownerId;
    if (item.ownerId === uid) {
      if (!participantId) throw new ApiError(400, 'Choose who you want to message');
      if (!store.claims.some((c) => c.itemId === itemId && c.claimantId === participantId)) {
        throw new ApiError(403, 'You can message members who have sent a request on this listing');
      }
      other = participantId;
    }
    let convo = store.conversations.find((c) => c.itemId === itemId && c.members.includes(uid) && c.members.includes(other));
    if (!convo) {
      convo = { id: crypto.randomUUID(), itemId, members: [uid, other], lastAt: new Date().toISOString() };
      store.conversations.push(convo);
      profileOf(store, other);
      persist(store);
    }
    return toConversation(convo, store, uid);
  },

  async getConversation(id) {
    await sleep(100);
    const { uid } = me();
    const store = load();
    return toConversation(conversationFor(store, id, uid), store, uid);
  },

  async listMessages(id, opts = {}) {
    await sleep(100);
    const { uid } = me();
    const store = load();
    conversationFor(store, id, uid);
    return store.messages
      .filter((m) => m.conversationId === id)
      .filter((m) => !opts.after || m.createdAt > opts.after)
      .filter((m) => !opts.before || m.createdAt < opts.before)
      .map((m) => toMessage(m, uid));
  },

  async sendMessage(id, content, clientMessageId) {
    await sleep(150);
    const { uid } = me();
    const store = load();
    const convo = conversationFor(store, id, uid);
    const text = content.trim();
    if (!text) throw new ApiError(400, 'Message cannot be empty');
    if (text.length > 2000) throw new ApiError(400, 'Messages are limited to 2,000 characters');
    const existing = store.messages.find((m) => m.clientMessageId === clientMessageId && m.senderId === uid);
    if (existing) return toMessage(existing, uid);
    const message: StoredMessage = {
      id: crypto.randomUUID(),
      conversationId: id,
      senderId: uid,
      content: text,
      clientMessageId,
      readBy: [uid],
      createdAt: new Date().toISOString(),
    };
    store.messages.push(message);
    convo.lastAt = message.createdAt;
    persist(store);
    return toMessage(message, uid);
  },

  async markConversationRead(id) {
    const { uid } = me();
    const store = load();
    conversationFor(store, id, uid);
    store.messages.forEach((m) => {
      if (m.conversationId === id && m.senderId !== uid && !m.readBy.includes(uid)) m.readBy.push(uid);
    });
    persist(store);
  },
};
