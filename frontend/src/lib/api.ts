import { seedItems, type StoredItem } from './mockData';
import { session } from './session';
import type { Claim, ClaimStatus, Item, ItemFilters, NewItemInput } from './types';

export class ApiError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export interface Api {
  listItems(filters: ItemFilters, signal?: AbortSignal): Promise<Item[]>;
  getItem(id: string): Promise<Item>;
  createItem(input: NewItemInput): Promise<Item>;
  toggleSave(id: string): Promise<boolean>;
  listMine(): Promise<Item[]>;
  listSaved(): Promise<Item[]>;
  listClaims(): Promise<Claim[]>;
  submitClaim(itemId: string, message: string): Promise<Claim>;
  decideClaim(claimId: string, decision: 'approve' | 'reject' | 'withdraw'): Promise<Claim>;
  resolveItem(id: string): Promise<Item>;
}

/* ------------------------------------------------------------------ */
/* Mock implementation (VITE_USE_MOCK=true). Demo data lives in        */
/* localStorage. Uploaded photos use temporary object URLs.            */
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

interface Store {
  items: StoredItem[];
  saved: string[];
  claims: StoredClaim[];
  keys: Record<string, string>;
}

const STORE_KEY = 'returnit.mock.v2';
const DEMO_OWNER_EMAIL = 'demo.owner@mnnit.ac.in';
const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

function persist(store: Store): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(store));
  } catch {
    /* storage unavailable: demo state simply is not persisted */
  }
}

function load(): Store {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (raw) return JSON.parse(raw) as Store;
  } catch {
    /* fall through to a fresh store */
  }
  const fresh: Store = { items: seedItems(), saved: [], claims: [], keys: {} };
  persist(fresh);
  return fresh;
}

function currentUid(): string {
  const user = session.user;
  if (!user) throw new ApiError(401, 'Please sign in to continue.');
  return user.uid;
}

function toItem(item: StoredItem, store: Store): Item {
  const me = session.user?.uid;
  const { ownerId, ...rest } = item;
  const latest = me
    ? [...store.claims].reverse().find((c) => c.itemId === item.id && c.claimantId === me)
    : undefined;
  return { ...rest, isOwner: me === ownerId, saved: store.saved.includes(item.id), myClaimStatus: latest?.status };
}

function toClaim(c: StoredClaim, store: Store): Claim {
  const me = currentUid();
  const item = store.items.find((i) => i.id === c.itemId);
  const received = item?.ownerId === me;
  const ownerName = item?.owner.name ?? 'Owner';
  return {
    id: c.id,
    itemId: c.itemId,
    itemTitle: item?.title ?? 'Removed listing',
    itemType: item?.type ?? 'found',
    direction: received ? 'received' : 'sent',
    counterpartName: received ? c.claimantName : ownerName,
    message: c.message,
    status: c.status,
    createdAt: c.createdAt,
    contact:
      c.status === 'approved'
        ? { name: received ? c.claimantName : ownerName, email: received ? c.claimantEmail : DEMO_OWNER_EMAIL }
        : undefined,
  };
}

const mockApi: Api = {
  async listItems(f) {
    await sleep(300);
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
    await sleep(200);
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    return toItem(item, store);
  },

  async createItem(input) {
    await sleep(500);
    const store = load();
    const me = session.user;
    if (!me) throw new ApiError(401, 'Please sign in to continue.');
    const existingId = store.keys[input.idempotencyKey];
    const existing = existingId ? store.items.find((i) => i.id === existingId) : undefined;
    if (existing) return toItem(existing, store);
    const item: StoredItem = {
      id: crypto.randomUUID(),
      type: input.type,
      title: input.title,
      description: input.description,
      category: input.category,
      locationLabel: input.locationLabel,
      dateOccurred: input.dateOccurred,
      createdAt: new Date().toISOString(),
      status: 'open',
      images: input.images.map((file, index) => ({ url: URL.createObjectURL(file), alt: `${input.title} (photo ${index + 1})` })),
      owner: { name: me.name },
      ownerId: me.uid,
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
    await sleep(120);
    currentUid();
    const store = load();
    const on = !store.saved.includes(id);
    store.saved = on ? [...store.saved, id] : store.saved.filter((x) => x !== id);
    persist(store);
    return on;
  },

  async listMine() {
    await sleep(250);
    const me = currentUid();
    const store = load();
    return store.items.filter((i) => i.ownerId === me).map((i) => toItem(i, store));
  },

  async listSaved() {
    await sleep(250);
    currentUid();
    const store = load();
    return store.items.filter((i) => store.saved.includes(i.id)).map((i) => toItem(i, store));
  },

  async listClaims() {
    await sleep(250);
    const me = currentUid();
    const store = load();
    return store.claims
      .filter((c) => c.claimantId === me || store.items.find((i) => i.id === c.itemId)?.ownerId === me)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
      .map((c) => toClaim(c, store));
  },

  async submitClaim(itemId, message) {
    await sleep(400);
    const me = session.user;
    if (!me) throw new ApiError(401, 'Please sign in to continue.');
    const store = load();
    const item = store.items.find((i) => i.id === itemId);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    if (item.ownerId === me.uid) throw new ApiError(403, 'You cannot send a request on your own listing.');
    if (item.status === 'resolved' || item.status === 'expired') throw new ApiError(409, 'This listing is closed.');
    const active = store.claims.some((c) => c.itemId === itemId && c.claimantId === me.uid && (c.status === 'pending' || c.status === 'approved'));
    if (active) throw new ApiError(409, 'You already have a request on this listing.');
    const claim: StoredClaim = {
      id: crypto.randomUUID(),
      itemId,
      claimantId: me.uid,
      claimantName: me.name,
      claimantEmail: me.email,
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
    await sleep(300);
    const me = currentUid();
    const store = load();
    const claim = store.claims.find((c) => c.id === claimId);
    const item = claim ? store.items.find((i) => i.id === claim.itemId) : undefined;
    if (!claim || !item) throw new ApiError(404, 'Request not found.');
    if (claim.status !== 'pending') throw new ApiError(409, 'This request has already been handled.');
    if (decision === 'withdraw') {
      if (claim.claimantId !== me) throw new ApiError(403, 'Only the requester can withdraw a request.');
      claim.status = 'withdrawn';
    } else {
      if (item.ownerId !== me) throw new ApiError(403, 'Only the listing owner can do this.');
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
    if (item.status === 'claim_pending' && !store.claims.some((c) => c.itemId === item.id && c.status === 'pending')) {
      item.status = 'open';
    }
    persist(store);
    return toClaim(claim, store);
  },

  async resolveItem(id) {
    await sleep(300);
    const me = currentUid();
    const store = load();
    const item = store.items.find((i) => i.id === id);
    if (!item) throw new ApiError(404, 'This listing no longer exists.');
    if (item.ownerId !== me) throw new ApiError(403, 'Only the listing owner can do this.');
    item.status = 'resolved';
    persist(store);
    return toItem(item, store);
  },
};

/* ------------------------------------------------------------------ */
/* Real implementation: talks to the Express API with a Firebase token */
/* ------------------------------------------------------------------ */

const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5000/api';

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await session.getToken();
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, { ...init, headers });
  } catch {
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.');
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    try {
      const body = (await response.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      /* response was not JSON; keep the generic message */
    }
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const enc = encodeURIComponent;

const realApi: Api = {
  async listItems(f, signal) {
    const params = new URLSearchParams();
    if (f.type) params.set('type', f.type);
    if (f.category) params.set('category', f.category);
    if (f.q) params.set('q', f.q);
    if (f.location) params.set('location', f.location);
    if (f.status) params.set('status', f.status);
    const result = await request<{ items: Item[] }>(`/items?${params.toString()}`, { signal });
    return result.items;
  },
  getItem: (id) => request<Item>(`/items/${enc(id)}`),
  createItem(input) {
    const body = new FormData();
    body.set('type', input.type);
    body.set('title', input.title);
    body.set('description', input.description);
    body.set('category', input.category);
    body.set('locationLabel', input.locationLabel);
    body.set('dateOccurred', input.dateOccurred);
    if (input.verificationQuestion) body.set('verificationQuestion', input.verificationQuestion);
    if (input.verificationAnswer) body.set('verificationAnswer', input.verificationAnswer);
    input.images.forEach((file) => body.append('images', file));
    return request<Item>('/items', { method: 'POST', body, headers: { 'Idempotency-Key': input.idempotencyKey } });
  },
  async toggleSave(id) {
    const result = await request<{ saved: boolean }>(`/items/${enc(id)}/save`, { method: 'POST' });
    return result.saved;
  },
  async listMine() {
    return (await request<{ items: Item[] }>('/items?mine=true')).items;
  },
  async listSaved() {
    return (await request<{ items: Item[] }>('/items?saved=true')).items;
  },
  async listClaims() {
    return (await request<{ claims: Claim[] }>('/claims')).claims;
  },
  submitClaim: (itemId, message) =>
    request<Claim>(`/items/${enc(itemId)}/claims`, { method: 'POST', body: JSON.stringify({ message }) }),
  decideClaim: (claimId, decision) => request<Claim>(`/claims/${enc(claimId)}/${decision}`, { method: 'POST' }),
  resolveItem: (id) => request<Item>(`/items/${enc(id)}/resolve`, { method: 'POST' }),
};

export const api: Api = import.meta.env.VITE_USE_MOCK === 'true' ? mockApi : realApi;
