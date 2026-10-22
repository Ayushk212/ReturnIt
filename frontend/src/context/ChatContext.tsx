import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import type { Socket } from 'socket.io-client';
import { api, API_BASE_URL, USE_MOCK } from '../lib/api';
import { session } from '../lib/session';
import type { ChatMessage, NavSummary } from '../lib/types';
import { useAuth } from './AuthContext';

export type ChatEvent =
  | { type: 'message'; conversationId: string; message: ChatMessage }
  | { type: 'read'; conversationId: string };

interface ChatContextValue {
  summary: NavSummary;
  /** True while a live connection is open; otherwise the app falls back to periodic refreshes. */
  live: boolean;
  refreshSummary: () => Promise<void>;
  subscribe: (listener: (event: ChatEvent) => void) => () => void;
}

const EMPTY: NavSummary = { unreadMessages: 0, pendingRequests: 0 };
const ChatContext = createContext<ChatContextValue | null>(null);

function socketOrigin(): string {
  const explicit = import.meta.env.VITE_SOCKET_URL;
  if (explicit) return explicit;
  if (/^https?:\/\//.test(API_BASE_URL)) return new URL(API_BASE_URL).origin;
  return window.location.origin; // same-origin API behind a proxy
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const [summary, setSummary] = useState<NavSummary>(EMPTY);
  const [live, setLive] = useState(false);
  const listeners = useRef(new Set<(event: ChatEvent) => void>());

  const refreshSummary = useCallback(async () => {
    if (!session.user) {
      setSummary(EMPTY);
      return;
    }
    try {
      setSummary(await api.getSummary());
    } catch {
      /* badges are best-effort */
    }
  }, []);

  const subscribe = useCallback((listener: (event: ChatEvent) => void) => {
    listeners.current.add(listener);
    return () => {
      listeners.current.delete(listener);
    };
  }, []);

  // Live connection for the signed-in user. The client library loads only after sign-in.
  useEffect(() => {
    if (!user || USE_MOCK) return undefined;
    let socket: Socket | null = null;
    let cancelled = false;
    const emit = (event: ChatEvent) => listeners.current.forEach((l) => l(event));

    void import('socket.io-client').then(({ io }) => {
      if (cancelled) return;
      socket = io(socketOrigin(), {
        path: '/socket.io',
        transports: ['websocket', 'polling'],
        // Called on every (re)connect, so an expired short-lived token is replaced automatically.
        auth: (cb) => {
          void session.getToken().then((token) => cb({ token }));
        },
      });
      socket.on('connect', () => setLive(true));
      socket.on('disconnect', () => setLive(false));
      socket.on('connect_error', () => setLive(false));
      socket.on('message:new', (payload: { conversationId: string; message: ChatMessage }) => {
        emit({ type: 'message', ...payload });
        if (!payload.message.fromMe) void refreshSummary();
      });
      socket.on('conversation:read', (payload: { conversationId: string }) => {
        emit({ type: 'read', conversationId: payload.conversationId });
        void refreshSummary();
      });
    });

    return () => {
      cancelled = true;
      socket?.removeAllListeners();
      socket?.disconnect();
      setLive(false);
    };
  }, [user, refreshSummary]);

  // Badge refresh: on sign-in, on focus, and periodically (more often without a live connection).
  useEffect(() => {
    if (!user) {
      setSummary(EMPTY);
      return undefined;
    }
    void refreshSummary();
    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void refreshSummary();
    }, USE_MOCK ? 5_000 : live ? 120_000 : 30_000);
    const onFocus = () => void refreshSummary();
    window.addEventListener('focus', onFocus);
    return () => {
      window.clearInterval(interval);
      window.removeEventListener('focus', onFocus);
    };
  }, [user, live, refreshSummary]);

  const value = useMemo(() => ({ summary, live, refreshSummary, subscribe }), [summary, live, refreshSummary, subscribe]);
  return <ChatContext.Provider value={value}>{children}</ChatContext.Provider>;
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used inside ChatProvider');
  return ctx;
}
