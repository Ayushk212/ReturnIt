import { ApiError } from './apiError';
import { mockApi } from './mockApi';
import { session } from './session';
import type {
  ChatMessage,
  Claim,
  Conversation,
  Item,
  ItemFilters,
  MyProfile,
  NavSummary,
  NewItemInput,
  OnboardingInput,
  ProfileUpdate,
  PublicProfile,
  ReportReason,
} from './types';

export { ApiError };

export interface Api {
  listItems(filters: ItemFilters, signal?: AbortSignal): Promise<Item[]>;
  getItem(id: string): Promise<Item>;
  getMatches(id: string): Promise<Item[]>;
  createItem(input: NewItemInput): Promise<Item>;
  toggleSave(id: string): Promise<boolean>;
  listMine(): Promise<Item[]>;
  listSaved(): Promise<Item[]>;
  listClaims(): Promise<Claim[]>;
  submitClaim(itemId: string, message: string): Promise<Claim>;
  decideClaim(claimId: string, decision: 'approve' | 'reject' | 'withdraw'): Promise<Claim>;
  resolveItem(id: string): Promise<Item>;
  renewItem(id: string): Promise<Item>;
  reportItem(id: string, reason: ReportReason, details: string): Promise<{ alreadyReported: boolean }>;

  getMe(): Promise<MyProfile>;
  completeOnboarding(input: OnboardingInput): Promise<MyProfile>;
  updateProfile(update: ProfileUpdate): Promise<MyProfile>;
  uploadAvatar(file: File): Promise<MyProfile>;
  removeAvatar(): Promise<MyProfile>;
  getPublicProfile(id: string): Promise<PublicProfile>;
  listUserListings(id: string): Promise<Item[]>;
  getSummary(): Promise<NavSummary>;

  listConversations(): Promise<Conversation[]>;
  startConversation(itemId: string, participantId?: string): Promise<Conversation>;
  getConversation(id: string): Promise<Conversation>;
  listMessages(id: string, opts?: { before?: string; after?: string }): Promise<ChatMessage[]>;
  sendMessage(id: string, content: string, clientMessageId: string): Promise<ChatMessage>;
  markConversationRead(id: string): Promise<void>;
}

/* ------------------------------------------------------------------ */
/* Real implementation: talks to the Express API with a Neon Auth JWT  */
/* ------------------------------------------------------------------ */

export const API_BASE_URL = (import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '');

async function send(path: string, init: RequestInit, token: string | null): Promise<Response> {
  const headers = new Headers(init.headers);
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !(init.body instanceof FormData)) headers.set('Content-Type', 'application/json');
  try {
    return await fetch(`${API_BASE_URL}${path}`, { ...init, headers });
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') throw e;
    throw new ApiError(0, 'Could not reach the server. Check your connection and try again.', 'NETWORK');
  }
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  let response = await send(path, init, await session.getToken());
  // Tokens are short-lived; on an expired token, refresh once and retry.
  if (response.status === 401 && session.user) {
    const fresh = await session.getToken(true);
    if (fresh) response = await send(path, init, fresh);
  }
  if (!response.ok) {
    let message = 'Something went wrong. Please try again.';
    let code: string | undefined;
    try {
      const body = (await response.json()) as { error?: { message?: string; code?: string } };
      if (body.error?.message) message = body.error.message;
      code = body.error?.code;
    } catch {
      /* not JSON; keep the generic message */
    }
    if (response.status === 429 && !code) message = 'Too many requests. Please wait a moment and try again.';
    throw new ApiError(response.status, message, code);
  }
  if (response.status === 204) return undefined as T;
  return (await response.json()) as T;
}

const enc = encodeURIComponent;
const json = (body: unknown): RequestInit => ({ method: 'POST', body: JSON.stringify(body) });

const realApi: Api = {
  async listItems(f, signal) {
    const params = new URLSearchParams();
    if (f.type) params.set('type', f.type);
    if (f.category) params.set('category', f.category);
    if (f.q) params.set('q', f.q);
    if (f.location) params.set('location', f.location);
    if (f.status) params.set('status', f.status);
    return (await request<{ items: Item[] }>(`/items?${params.toString()}`, { signal })).items;
  },
  getItem: (id) => request<Item>(`/items/${enc(id)}`),
  async getMatches(id) {
    return (await request<{ items: Item[] }>(`/items/${enc(id)}/matches`)).items;
  },
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
    return (await request<{ saved: boolean }>(`/items/${enc(id)}/save`, { method: 'POST' })).saved;
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
  submitClaim: (itemId, message) => request<Claim>(`/items/${enc(itemId)}/claims`, json({ message })),
  decideClaim: (claimId, decision) => request<Claim>(`/claims/${enc(claimId)}/${decision}`, { method: 'POST' }),
  resolveItem: (id) => request<Item>(`/items/${enc(id)}/resolve`, { method: 'POST' }),
  renewItem: (id) => request<Item>(`/items/${enc(id)}/renew`, { method: 'POST' }),
  reportItem: (id, reason, details) => request<{ alreadyReported: boolean }>(`/items/${enc(id)}/report`, json({ reason, details })),

  async getMe() {
    return (await request<{ user: MyProfile }>('/users/me')).user;
  },
  async completeOnboarding(input) {
    return (await request<{ user: MyProfile }>('/users/me/onboarding', json(input))).user;
  },
  async updateProfile(update) {
    return (await request<{ user: MyProfile }>('/users/me', { method: 'PATCH', body: JSON.stringify(update) })).user;
  },
  async uploadAvatar(file) {
    const body = new FormData();
    body.set('avatar', file);
    return (await request<{ user: MyProfile }>('/users/me/avatar', { method: 'POST', body })).user;
  },
  async removeAvatar() {
    return (await request<{ user: MyProfile }>('/users/me/avatar', { method: 'DELETE' })).user;
  },
  async getPublicProfile(id) {
    return (await request<{ user: PublicProfile }>(`/users/${enc(id)}`)).user;
  },
  async listUserListings(id) {
    return (await request<{ items: Item[] }>(`/users/${enc(id)}/listings`)).items;
  },
  getSummary: () => request<NavSummary>('/users/me/summary'),

  async listConversations() {
    return (await request<{ conversations: Conversation[] }>('/conversations')).conversations;
  },
  async startConversation(itemId, participantId) {
    return (await request<{ conversation: Conversation }>('/conversations', json({ itemId, participantId }))).conversation;
  },
  async getConversation(id) {
    return (await request<{ conversation: Conversation }>(`/conversations/${enc(id)}`)).conversation;
  },
  async listMessages(id, opts = {}) {
    const params = new URLSearchParams();
    if (opts.before) params.set('before', opts.before);
    if (opts.after) params.set('after', opts.after);
    return (await request<{ messages: ChatMessage[] }>(`/conversations/${enc(id)}/messages?${params.toString()}`)).messages;
  },
  async sendMessage(id, content, clientMessageId) {
    return (await request<{ message: ChatMessage }>(`/conversations/${enc(id)}/messages`, json({ content, clientMessageId }))).message;
  },
  async markConversationRead(id) {
    await request(`/conversations/${enc(id)}/read`, { method: 'POST' });
  },
};

export const USE_MOCK = import.meta.env.VITE_USE_MOCK === 'true';

// VITE_USE_MOCK is inlined at build time, so the unused implementation is removed from the bundle.
export const api: Api = USE_MOCK ? mockApi : realApi;
