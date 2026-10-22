import { Fragment, useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { m } from 'motion/react';
import { AlertCircle, ArrowLeft, Check, CheckCheck, Inbox, MessageCircle, RotateCw, Search, Send, ShieldCheck } from 'lucide-react';
import Avatar from '../components/Avatar';
import { ErrorState } from '../components/States';
import { ItemStatusBadge } from '../components/StatusBadge';
import TypeLabel from '../components/TypeLabel';
import { useChat } from '../context/ChatContext';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { api } from '../lib/api';
import { dayLabel, formatTime, shortStamp } from '../lib/format';
import { EASE_OUT } from '../lib/motion';
import type { ChatMessage, Conversation } from '../lib/types';

type Outgoing = ChatMessage & { state?: 'sending' | 'failed' };

const MAX_LENGTH = 2000;

function mergeMessages(current: Outgoing[], incoming: ChatMessage[]): Outgoing[] {
  const byClient = new Map(current.map((m) => [m.clientMessageId, m]));
  for (const msg of incoming) byClient.set(msg.clientMessageId, msg);
  return [...byClient.values()].sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

/* ------------------------------------------------------------------ */
/* Inbox                                                              */
/* ------------------------------------------------------------------ */

function InboxList({ conversations, activeId, loading, error, onRetry }: { conversations: Conversation[]; activeId?: string; loading: boolean; error: string | null; onRetry: () => void }) {
  const [filter, setFilter] = useState('');
  const visible = conversations.filter((c) => {
    const q = filter.trim().toLowerCase();
    return !q || c.counterpart.name.toLowerCase().includes(q) || c.item.title.toLowerCase().includes(q);
  });

  return (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-line p-4">
        <h1 className="font-display text-2xl font-bold tracking-tight">Messages</h1>
        <div className="relative mt-3">
          <Search size={15} aria-hidden className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <label htmlFor="inbox-filter" className="sr-only">Filter conversations</label>
          <input
            id="inbox-filter"
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Search by name or item"
            className="field h-10 rounded-full border-transparent bg-paper pl-10 text-sm hover:border-line focus:bg-surface"
          />
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto">
        {loading && conversations.length === 0 ? (
          <ul aria-label="Loading conversations" className="space-y-1 p-2">
            {Array.from({ length: 5 }, (_, i) => (
              <li key={i} className="flex items-center gap-3 rounded-2xl p-3">
                <div className="skeleton h-11 w-11 rounded-full" />
                <div className="flex-1 space-y-2">
                  <div className="skeleton h-3 w-1/2" />
                  <div className="skeleton h-3 w-4/5" />
                </div>
              </li>
            ))}
          </ul>
        ) : error ? (
          <div className="p-4"><ErrorState message={error} onRetry={onRetry} /></div>
        ) : visible.length === 0 ? (
          <div className="flex flex-col items-center px-6 py-14 text-center">
            <span className="grid h-12 w-12 -rotate-6 place-items-center rounded-2xl bg-paper text-ink-soft" aria-hidden>
              <Inbox size={22} />
            </span>
            <p className="mt-4 font-display text-lg font-semibold">{filter ? 'No conversations match' : 'No conversations yet'}</p>
            <p className="mt-1 max-w-xs text-sm text-muted">
              {filter ? 'Try a different name or item.' : 'Open any listing and choose “Message” to contact the person who posted it.'}
            </p>
            {!filter && <Link to="/dashboard" className="btn-secondary btn-sm mt-5">Browse listings</Link>}
          </div>
        ) : (
          <ul className="space-y-0.5 p-2">
            {visible.map((c) => {
              const active = c.id === activeId;
              return (
                <li key={c.id}>
                  <Link
                    to={`/messages/${c.id}`}
                    aria-current={active ? 'page' : undefined}
                    className={`flex items-center gap-3 rounded-2xl p-3 transition-colors ${active ? 'bg-cobalt-soft' : 'hover:bg-paper'}`}
                  >
                    <Avatar name={c.counterpart.name} src={c.counterpart.avatarUrl} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className={`truncate text-sm ${c.unreadCount ? 'font-bold' : 'font-semibold'}`}>{c.counterpart.name}</span>
                        <span className="shrink-0 font-mono text-[10px] text-muted">{shortStamp(c.lastMessage?.createdAt ?? c.updatedAt)}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs font-medium text-cobalt-ink">{c.item.title}</span>
                      <span className="mt-0.5 flex items-center gap-2">
                        <span className={`truncate text-xs ${c.unreadCount ? 'font-semibold text-ink' : 'text-muted'}`}>
                          {c.lastMessage ? `${c.lastMessage.fromMe ? 'You: ' : ''}${c.lastMessage.content}` : 'No messages yet'}
                        </span>
                        {c.unreadCount > 0 && (
                          <span className="ml-auto grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-coral px-1.5 font-mono text-[10px] font-semibold text-ink" aria-label={`${c.unreadCount} unread`}>
                            {c.unreadCount}
                          </span>
                        )}
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Thread                                                             */
/* ------------------------------------------------------------------ */

function Thread({ id, onActivity }: { id: string; onActivity: () => void }) {
  const { live, subscribe, refreshSummary } = useChat();
  const [conversation, setConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Outgoing[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null);
  const composer = useRef<HTMLTextAreaElement>(null);
  const stickToBottom = useRef(true);
  const latest = useRef<string | undefined>(undefined);

  const markRead = useCallback(async () => {
    if (document.visibilityState !== 'visible') return;
    try {
      await api.markConversationRead(id);
      void refreshSummary();
      onActivity();
    } catch {
      /* read receipts are best-effort */
    }
  }, [id, refreshSummary, onActivity]);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [c, msgs] = await Promise.all([api.getConversation(id), api.listMessages(id)]);
      setConversation(c);
      setMessages(msgs);
      latest.current = msgs[msgs.length - 1]?.createdAt;
      stickToBottom.current = true;
      if (c.unreadCount > 0) void markRead();
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not open this conversation.');
    } finally {
      setLoading(false);
    }
  }, [id, markRead]);

  useEffect(() => {
    setMessages([]);
    setConversation(null);
    setDraft('');
    setSendError(null);
    void load();
  }, [load]);

  const fetchNewer = useCallback(async () => {
    try {
      const fresh = await api.listMessages(id, { after: latest.current });
      if (fresh.length) {
        setMessages((cur) => mergeMessages(cur, fresh));
        latest.current = fresh[fresh.length - 1].createdAt;
        if (fresh.some((m) => !m.fromMe)) void markRead();
      }
    } catch {
      /* try again on the next tick */
    }
  }, [id, markRead]);

  // Live events for this conversation.
  useEffect(
    () =>
      subscribe((event) => {
        if (event.conversationId !== id) return;
        if (event.type === 'message') {
          setMessages((cur) => mergeMessages(cur, [event.message]));
          latest.current = event.message.createdAt;
          if (!event.message.fromMe) void markRead();
        } else {
          setMessages((cur) => cur.map((m) => (m.fromMe ? { ...m, read: true } : m)));
        }
      }),
    [id, subscribe, markRead],
  );

  // Without a live connection, check for new messages every few seconds while the tab is visible.
  useEffect(() => {
    if (live) return undefined;
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void fetchNewer();
    }, 5000);
    return () => window.clearInterval(t);
  }, [live, fetchNewer]);

  useLayoutEffect(() => {
    const el = scroller.current;
    if (el && stickToBottom.current) el.scrollTop = el.scrollHeight;
  }, [messages]);

  async function deliver(text: string, clientMessageId: string) {
    setSendError(null);
    try {
      const saved = await api.sendMessage(id, text, clientMessageId);
      setMessages((cur) => mergeMessages(cur, [saved]));
      latest.current = saved.createdAt > (latest.current ?? '') ? saved.createdAt : latest.current;
      onActivity();
    } catch (e) {
      setMessages((cur) => cur.map((m) => (m.clientMessageId === clientMessageId ? { ...m, state: 'failed' } : m)));
      setSendError(e instanceof Error ? e.message : 'Message not sent.');
    }
  }

  function submit(e?: FormEvent) {
    e?.preventDefault();
    const text = draft.trim();
    if (!text || text.length > MAX_LENGTH) return;
    const clientMessageId = crypto.randomUUID();
    const optimistic: Outgoing = {
      id: clientMessageId,
      conversationId: id,
      fromMe: true,
      content: text,
      clientMessageId,
      read: false,
      createdAt: new Date().toISOString(),
      state: 'sending',
    };
    stickToBottom.current = true;
    setMessages((cur) => [...cur, optimistic]);
    setDraft('');
    composer.current?.focus();
    void deliver(text, clientMessageId);
  }

  function retry(msg: Outgoing) {
    setMessages((cur) => cur.map((m) => (m.clientMessageId === msg.clientMessageId ? { ...m, state: 'sending' } : m)));
    void deliver(msg.content, msg.clientMessageId);
  }

  function onKeyDown(e: KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
      e.preventDefault();
      submit();
    }
  }

  // Auto-grow the composer up to a limit.
  useLayoutEffect(() => {
    const el = composer.current;
    if (!el) return;
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight + 2, 160)}px`;
    el.style.overflowY = el.scrollHeight > 160 ? 'auto' : 'hidden';
  }, [draft]);

  const lastMineId = useMemo(() => [...messages].reverse().find((m) => m.fromMe && !m.state)?.clientMessageId, [messages]);

  if (loadError) {
    return (
      <div className="grid h-full place-items-center p-6">
        <ErrorState title="This conversation is unavailable." message={loadError} onRetry={load} />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center gap-3 border-b border-line px-4 py-3">
        <Link to="/messages" className="grid h-9 w-9 place-items-center rounded-full hover:bg-paper lg:hidden" aria-label="Back to conversations">
          <ArrowLeft size={18} aria-hidden />
        </Link>
        {conversation ? (
          <>
            <Link to={`/u/${conversation.counterpart.id}`} className="flex min-w-0 items-center gap-3 rounded-full pr-2 hover:opacity-80">
              <Avatar name={conversation.counterpart.name} src={conversation.counterpart.avatarUrl} />
              <span className="min-w-0">
                <span className="block truncate font-semibold">{conversation.counterpart.name}</span>
                <span className="block text-xs text-muted">{conversation.item.isMine ? 'Contacted you about your listing' : 'Posted this listing'}</span>
              </span>
            </Link>
            <Link to={`/items/${conversation.item.id}`} className="ml-auto hidden max-w-[45%] items-center gap-2 rounded-2xl border border-line p-1.5 pr-3 transition-colors hover:border-line-strong sm:flex">
              {conversation.item.thumbUrl ? (
                <img src={conversation.item.thumbUrl} alt="" className="h-9 w-9 shrink-0 rounded-xl object-cover" />
              ) : (
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-paper text-muted" aria-hidden><MessageCircle size={16} /></span>
              )}
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold">{conversation.item.title}</span>
                <span className="mt-0.5 flex gap-1"><TypeLabel type={conversation.item.type} className="py-0.5" /><ItemStatusBadge status={conversation.item.status} className="py-0.5" /></span>
              </span>
            </Link>
          </>
        ) : (
          <div className="flex items-center gap-3"><div className="skeleton h-11 w-11 rounded-full" /><div className="skeleton h-4 w-32" /></div>
        )}
      </header>

      <div
        ref={scroller}
        onScroll={(e) => {
          const el = e.currentTarget;
          stickToBottom.current = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
        }}
        className="min-h-0 flex-1 overflow-y-auto bg-paper/60 px-4 py-5 sm:px-6"
        aria-live="polite"
        aria-label="Messages"
      >
        <div className="mx-auto mb-5 flex max-w-md gap-2 rounded-2xl border border-line bg-surface p-3 text-xs text-muted">
          <ShieldCheck size={16} aria-hidden className="mt-px shrink-0 text-lime-ink" />
          <p>Agree on a public handover point on campus. Never share OTPs, passwords or payment details. Messages are visible only to the two of you.</p>
        </div>
        {loading && messages.length === 0 ? (
          <div className="space-y-3" aria-label="Loading messages">
            {[60, 40, 70].map((w, i) => (
              <div key={i} className={`skeleton h-10 rounded-2xl ${i % 2 ? 'ml-auto' : ''}`} style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : messages.length === 0 ? (
          <p className="mt-10 text-center text-sm text-muted">
            Start the conversation. Describe the item or suggest where to meet.
          </p>
        ) : (
          <ol className="space-y-1.5">
            {messages.map((msg, i) => {
              const prev = messages[i - 1];
              const newDay = !prev || dayLabel(prev.createdAt) !== dayLabel(msg.createdAt);
              const grouped = prev && !newDay && prev.fromMe === msg.fromMe;
              return (
                <Fragment key={msg.clientMessageId}>
                  {newDay && (
                    <li className="py-3 text-center" aria-hidden>
                      <span className="chip bg-surface text-muted ring-1 ring-line">{dayLabel(msg.createdAt)}</span>
                    </li>
                  )}
                  <m.li
                    initial={msg.state === 'sending' ? { opacity: 0, y: 6 } : false}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, ease: EASE_OUT }}
                    className={`flex flex-col ${msg.fromMe ? 'items-end' : 'items-start'} ${grouped ? '' : 'pt-2'}`}
                  >
                    <div
                      className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-4 py-2.5 text-[15px] leading-relaxed sm:max-w-[70%] ${
                        msg.fromMe ? 'rounded-br-md bg-cobalt text-white' : 'rounded-bl-md bg-surface text-ink ring-1 ring-line'
                      } ${msg.state === 'failed' ? 'opacity-60' : ''}`}
                    >
                      {msg.content}
                    </div>
                    <span className="mt-1 flex items-center gap-1 px-1 font-mono text-[10px] text-muted">
                      {msg.state === 'sending' ? (
                        'Sending…'
                      ) : msg.state === 'failed' ? (
                        <button type="button" onClick={() => retry(msg)} className="inline-flex items-center gap-1 font-semibold text-danger hover:underline">
                          <RotateCw size={11} aria-hidden /> Not sent. Retry
                        </button>
                      ) : (
                        <>
                          <time dateTime={msg.createdAt}>{formatTime(msg.createdAt)}</time>
                          {msg.fromMe && msg.clientMessageId === lastMineId && (
                            <span className="inline-flex items-center gap-0.5">
                              {msg.read ? <CheckCheck size={12} aria-hidden className="text-cobalt" /> : <Check size={12} aria-hidden />}
                              {msg.read ? 'Seen' : 'Sent'}
                            </span>
                          )}
                        </>
                      )}
                    </span>
                  </m.li>
                </Fragment>
              );
            })}
          </ol>
        )}
      </div>

      <form onSubmit={submit} className="border-t border-line bg-surface p-3 sm:p-4">
        {sendError && (
          <p role="alert" className="mb-2 flex items-center gap-1.5 text-xs font-medium text-danger">
            <AlertCircle size={13} aria-hidden /> {sendError}
          </p>
        )}
        <div className="flex items-end gap-2">
          <label htmlFor="composer" className="sr-only">Write a message</label>
          <textarea
            id="composer"
            ref={composer}
            rows={1}
            value={draft}
            maxLength={MAX_LENGTH}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message"
            className="field max-h-40 min-h-[48px] resize-none rounded-2xl py-3 leading-snug"
          />
          <button type="submit" disabled={!draft.trim()} className="btn-primary h-12 w-12 shrink-0 rounded-2xl p-0" aria-label="Send message">
            <Send size={18} aria-hidden />
          </button>
        </div>
        <p className="mt-1.5 flex justify-between px-1 text-[11px] text-muted">
          <span className="hidden sm:inline">Press Enter to send and Shift + Enter for a new line.</span>
          {draft.length > MAX_LENGTH - 200 && <span className="font-mono">{draft.length}/{MAX_LENGTH}</span>}
        </p>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Messages() {
  const { id } = useParams();
  const navigate = useNavigate();
  const desktop = useMediaQuery('(min-width: 1024px)');
  const { live, subscribe } = useChat();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadInbox = useCallback(async () => {
    try {
      setConversations(await api.listConversations());
      setError(null);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load your conversations.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    document.title = 'Messages | ReturnIt';
    void loadInbox();
  }, [loadInbox]);

  useEffect(() => subscribe(() => void loadInbox()), [subscribe, loadInbox]);

  useEffect(() => {
    const t = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadInbox();
    }, live ? 60_000 : 15_000);
    return () => window.clearInterval(t);
  }, [live, loadInbox]);

  // On wide screens, open the most recent conversation by default.
  useEffect(() => {
    if (desktop && !id && conversations[0]) navigate(`/messages/${conversations[0].id}`, { replace: true });
  }, [desktop, id, conversations, navigate]);

  const showList = desktop || !id;
  const showThread = desktop || Boolean(id);

  return (
    <div className="on-dark relative isolate min-h-[100svh] bg-night pb-6 pt-24 sm:pt-28">
      <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
        <div className="absolute -right-40 -top-40 h-[36rem] w-[36rem] rounded-full bg-cobalt/30 blur-[120px]" />
        <div className="absolute inset-x-0 bottom-0 h-1/2 bg-[linear-gradient(rgba(255,255,255,0.045)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.045)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_top,black,transparent)] [transform:perspective(600px)_rotateX(58deg)] [transform-origin:bottom]" />
      </div>
      <div className="container-page">
        <div className="grid h-[calc(100svh-8.5rem)] min-h-[32rem] grid-cols-1 overflow-hidden rounded-panel border border-white/10 bg-surface text-ink shadow-pop lg:grid-cols-[22rem_1fr]">
          {showList && (
            <aside className="min-h-0 border-r border-line" aria-label="Conversations">
              <InboxList conversations={conversations} activeId={id} loading={loading} error={error} onRetry={loadInbox} />
            </aside>
          )}
          {showThread && (
            <section className="min-h-0" aria-label="Conversation">
              {id ? (
                <Thread key={id} id={id} onActivity={loadInbox} />
              ) : (
                <div className="grid h-full place-items-center p-8 text-center">
                  <div>
                    <span className="mx-auto grid h-14 w-14 -rotate-6 place-items-center rounded-2xl bg-cobalt-soft text-cobalt-ink" aria-hidden>
                      <MessageCircle size={24} />
                    </span>
                    <p className="mt-4 font-display text-xl font-semibold">Select a conversation</p>
                    <p className="mt-1 text-sm text-muted">Messages about your listings and requests appear here.</p>
                  </div>
                </div>
              )}
            </section>
          )}
        </div>
      </div>
    </div>
  );
}
