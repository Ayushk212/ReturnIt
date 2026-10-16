import { useEffect, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import ItemCard from '../components/ItemCard';
import ItemImage from '../components/ItemImage';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import TypeLabel from '../components/TypeLabel';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { claimStatusLabel, statusLabel, timeAgo } from '../lib/format';
import type { Claim, Item } from '../lib/types';

const TABS = [
  { key: 'posts', label: 'My posts' },
  { key: 'saved', label: 'Saved' },
  { key: 'claims', label: 'Requests' },
  { key: 'account', label: 'Account' },
] as const;
type TabKey = (typeof TABS)[number]['key'];

function MyPosts() {
  const { data, loading, error, reload } = useAsync(() => api.listMine(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function resolve(id: string) {
    if (!window.confirm('Mark this listing as resolved? It will be closed to new requests.')) return;
    setBusyId(id);
    setActionError(null);
    try {
      await api.resolveItem(id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the listing.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) return <p className="text-sm text-muted" role="status">Loading your posts…</p>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const items = data ?? [];
  if (items.length === 0) {
    return (
      <EmptyState title="You haven't posted anything yet">
        <p>Lost or found something? Add a listing and it will appear here.</p>
        <Link to="/post" className="btn-primary mt-4">Post an item</Link>
      </EmptyState>
    );
  }
  return (
    <>
      {actionError && <p role="alert" className="mb-3 text-sm text-lost">{actionError}</p>}
      <ul className="divide-y divide-line rounded-lg border border-line bg-surface">
        {items.map((item) => (
          <li key={item.id} className="flex flex-wrap items-center gap-4 p-4">
            <div className="h-16 w-16 shrink-0 overflow-hidden rounded-md border border-line">
              <ItemImage item={item} className="h-full w-full" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 text-xs text-muted">
                <TypeLabel type={item.type} />
                <span aria-hidden>·</span>
                <span>{statusLabel(item.status)}</span>
                <span aria-hidden>·</span>
                <span>{timeAgo(item.createdAt)}</span>
              </div>
              <Link to={`/items/${item.id}`} className="mt-1 block truncate font-medium hover:underline">{item.title}</Link>
              <p className="truncate text-sm text-muted">{item.locationLabel}</p>
            </div>
            <div className="flex gap-2">
              <Link to={`/items/${item.id}`} className="btn-secondary h-9">View</Link>
              {(item.status === 'open' || item.status === 'claim_pending') && (
                <button type="button" disabled={busyId === item.id} onClick={() => resolve(item.id)} className="btn-primary h-9">
                  {busyId === item.id ? 'Saving…' : 'Mark resolved'}
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
    </>
  );
}

function SavedItems() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.listSaved(), []);
  const [removed, setRemoved] = useState<string[]>([]);

  async function toggle(item: Item) {
    setRemoved((r) => [...r, item.id]);
    try {
      await api.toggleSave(item.id);
    } catch {
      setRemoved((r) => r.filter((id) => id !== item.id));
    }
  }

  if (loading && !data) {
    return <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}</div>;
  }
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const items = (data ?? []).filter((i) => !removed.includes(i.id));
  if (items.length === 0) {
    return (
      <EmptyState title="No saved items">
        <p>Use the bookmark on any listing to keep it here.</p>
        <Link to="/dashboard" className="btn-secondary mt-4">Browse listings</Link>
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
      {items.map((item) => <ItemCard key={item.id} item={item} signedIn={Boolean(user)} onToggleSave={toggle} />)}
    </div>
  );
}

function ClaimRow({ claim, busy, onDecide }: { claim: Claim; busy: boolean; onDecide: (id: string, d: 'approve' | 'reject' | 'withdraw') => void }) {
  return (
    <li className="p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-sm text-muted">{claim.direction === 'received' ? `${claim.counterpartName} sent a request on` : 'Your request on'}</p>
          <Link to={`/items/${claim.itemId}`} className="font-medium hover:underline">{claim.itemTitle}</Link>
        </div>
        <span className="text-sm font-medium">{claimStatusLabel(claim.status)}</span>
      </div>
      <p className="mt-3 rounded-md bg-paper p-3 text-sm">{claim.message}</p>
      {claim.contact && (
        <p className="mt-3 text-sm">
          Contact {claim.contact.name}:{' '}
          <a href={`mailto:${claim.contact.email}`} className="font-medium text-accent underline">{claim.contact.email}</a>
        </p>
      )}
      {claim.status === 'pending' && (
        <div className="mt-3 flex gap-2">
          {claim.direction === 'received' ? (
            <>
              <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'approve')} className="btn-primary h-9">Approve</button>
              <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'reject')} className="btn-secondary h-9">Decline</button>
            </>
          ) : (
            <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'withdraw')} className="btn-secondary h-9">Withdraw request</button>
          )}
        </div>
      )}
    </li>
  );
}

function Claims() {
  const { data, loading, error, reload } = useAsync(() => api.listClaims(), []);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(id: string, decision: 'approve' | 'reject' | 'withdraw') {
    setBusyId(id);
    setActionError(null);
    try {
      await api.decideClaim(id, decision);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the request.');
    } finally {
      setBusyId(null);
    }
  }

  if (loading && !data) return <p className="text-sm text-muted" role="status">Loading requests…</p>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const claims = data ?? [];
  const received = claims.filter((c) => c.direction === 'received');
  const sent = claims.filter((c) => c.direction === 'sent');

  return (
    <div className="space-y-10">
      {actionError && <p role="alert" className="text-sm text-lost">{actionError}</p>}
      <section aria-labelledby="received-heading">
        <h2 id="received-heading" className="text-xl font-medium">Requests on your listings</h2>
        {received.length === 0 ? (
          <p className="mt-3 text-sm text-muted">No one has sent a request on your listings yet.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {received.map((c) => <ClaimRow key={c.id} claim={c} busy={busyId === c.id} onDecide={decide} />)}
          </ul>
        )}
      </section>
      <section aria-labelledby="sent-heading">
        <h2 id="sent-heading" className="text-xl font-medium">Requests you sent</h2>
        {sent.length === 0 ? (
          <p className="mt-3 text-sm text-muted">You haven't sent any requests. Open a listing to claim an item or offer to return one.</p>
        ) : (
          <ul className="mt-3 divide-y divide-line rounded-lg border border-line bg-surface">
            {sent.map((c) => <ClaimRow key={c.id} claim={c} busy={busyId === c.id} onDecide={decide} />)}
          </ul>
        )}
      </section>
    </div>
  );
}

export default function Profile() {
  const { user, signOut } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const raw = params.get('tab');
  const tab: TabKey = TABS.some((t) => t.key === raw) ? (raw as TabKey) : 'posts';

  useEffect(() => {
    document.title = 'My account | ReturnIt';
  }, []);

  if (!user) return null;
  const initials = user.name.split(' ').map((p) => p[0]).slice(0, 2).join('').toUpperCase();

  return (
    <div className="container-page py-12">
      <header className="flex flex-wrap items-center gap-5">
        <div aria-hidden className="flex h-16 w-16 items-center justify-center rounded-full bg-ink font-serif text-2xl text-white">{initials}</div>
        <div>
          <h1 className="text-3xl font-medium">{user.name}</h1>
          <p className="text-sm text-muted">{user.email}</p>
        </div>
      </header>

      <nav aria-label="Account sections" className="mt-8 flex gap-6 border-b border-line">
        {TABS.map((t) => (
          <Link
            key={t.key}
            to={`/profile?tab=${t.key}`}
            aria-current={tab === t.key ? 'page' : undefined}
            className={`-mb-px border-b-2 py-3 text-sm font-medium ${tab === t.key ? 'border-accent text-ink' : 'border-transparent text-muted hover:text-ink'}`}
          >
            {t.label}
          </Link>
        ))}
      </nav>

      <div className="mt-8">
        {tab === 'posts' && <MyPosts />}
        {tab === 'saved' && <SavedItems />}
        {tab === 'claims' && <Claims />}
        {tab === 'account' && (
          <div className="max-w-md space-y-6">
            <dl className="divide-y divide-line rounded-lg border border-line bg-surface text-sm">
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted">Name</dt><dd>{user.name}</dd></div>
              <div className="flex justify-between gap-4 p-4"><dt className="text-muted">Email</dt><dd>{user.email}</dd></div>
            </dl>
            <p className="text-sm text-muted">Your email is visible only to people whose requests you approve, or whose listings you have an approved request on.</p>
            <button type="button" onClick={async () => { await signOut(); navigate('/'); }} className="btn-secondary">Sign out</button>
          </div>
        )}
      </div>
    </div>
  );
}
