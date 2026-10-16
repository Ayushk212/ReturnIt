import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { CATEGORIES, LOCATIONS } from '../lib/constants';
import type { Item, ItemType } from '../lib/types';

const TABS: { value: '' | ItemType; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'lost', label: 'Lost' },
  { value: 'found', label: 'Found' },
];

export default function Dashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const loc = useLocation();
  const [params, setParams] = useSearchParams();

  const rawType = params.get('type');
  const type: ItemType | undefined = rawType === 'lost' || rawType === 'found' ? rawType : undefined;
  const category = params.get('category') ?? '';
  const place = params.get('location') ?? '';
  const q = params.get('q') ?? '';

  const [search, setSearch] = useState(q);
  const [savedOverride, setSavedOverride] = useState<Record<string, boolean>>({});

  function setParam(key: string, value: string) {
    setParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        if (value) next.set(key, value);
        else next.delete(key);
        return next;
      },
      { replace: true },
    );
  }

  useEffect(() => {
    if (search.trim() === q) return undefined;
    const timer = window.setTimeout(() => setParam('q', search.trim()), 300);
    return () => window.clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const { data, loading, error, reload } = useAsync(
    (signal) => api.listItems({ type, category: category || undefined, location: place || undefined, q: q || undefined }, signal),
    [type, category, place, q, user?.uid],
  );

  useEffect(() => {
    setSavedOverride({});
  }, [data]);

  const items = (data ?? []).map((i) => ({ ...i, saved: savedOverride[i.id] ?? i.saved }));
  const filtersActive = Boolean(type || category || place || q);

  function clearFilters() {
    setSearch('');
    setParams({}, { replace: true });
  }

  async function toggleSave(item: Item) {
    if (!user) {
      navigate('/signin', { state: { from: loc.pathname + loc.search } });
      return;
    }
    const next = !item.saved;
    setSavedOverride((s) => ({ ...s, [item.id]: next }));
    try {
      await api.toggleSave(item.id);
    } catch {
      setSavedOverride((s) => ({ ...s, [item.id]: !next }));
    }
  }

  return (
    <div>
      <section className="border-b border-line">
        <div className="container-page py-10">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h1 className="text-3xl font-medium sm:text-4xl">Campus board</h1>
              <p className="mt-2 max-w-xl text-muted">Everything currently reported lost or found at MNNIT. Anyone can browse.</p>
            </div>
            <Link to="/post" className="btn-primary">
              <Plus size={16} aria-hidden /> Post an item
            </Link>
          </div>

          {!user && (
            <div className="mt-6 flex flex-wrap items-center justify-between gap-3 rounded-md border border-line bg-surface px-4 py-3 text-sm">
              <p className="text-muted">
                Sign in with your <span className="font-medium text-ink">@mnnit.ac.in</span> account to open listings, send a request, save items or post.
              </p>
              <Link to="/signin" state={{ from: '/dashboard' }} className="font-medium text-accent hover:underline">Sign in</Link>
            </div>
          )}
        </div>
      </section>

      <section className="container-page py-8">
        <div className="flex flex-wrap items-center gap-3">
          <div role="group" aria-label="Listing type" className="inline-flex rounded-md border border-line bg-surface p-1">
            {TABS.map((t) => (
              <button
                key={t.label}
                type="button"
                aria-pressed={(type ?? '') === t.value}
                onClick={() => setParam('type', t.value)}
                className={`rounded px-4 py-1.5 text-sm font-medium ${(type ?? '') === t.value ? 'bg-ink text-white' : 'text-muted hover:text-ink'}`}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div className="relative min-w-[14rem] flex-1">
            <label htmlFor="search" className="sr-only">Search listings</label>
            <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="search"
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by item, place or description"
              className="field pl-9"
            />
          </div>

          <div>
            <label htmlFor="category" className="sr-only">Category</label>
            <select id="category" value={category} onChange={(e) => setParam('category', e.target.value)} className="field">
              <option value="">All categories</option>
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label htmlFor="place" className="sr-only">Location</label>
            <select id="place" value={place} onChange={(e) => setParam('location', e.target.value)} className="field">
              <option value="">All locations</option>
              {LOCATIONS.map((l) => (
                <option key={l} value={l}>{l}</option>
              ))}
            </select>
          </div>

          {filtersActive && (
            <button type="button" onClick={clearFilters} className="btn-ghost">Clear filters</button>
          )}
        </div>

        <p className="mt-6 text-sm text-muted" aria-live="polite">
          {loading ? 'Loading listings…' : error ? '' : `${items.length} ${items.length === 1 ? 'listing' : 'listings'}`}
        </p>

        <div className="mt-4">
          {loading ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : items.length === 0 ? (
            filtersActive ? (
              <EmptyState title="No listings match these filters">
                <p>Try a different search, or clear the filters to see everything.</p>
                <button type="button" onClick={clearFilters} className="btn-secondary mt-4">Clear filters</button>
              </EmptyState>
            ) : (
              <EmptyState title="Nothing on the board yet">
                <p>Be the first to report a lost or found item.</p>
                <Link to="/post" className="btn-primary mt-4">Post an item</Link>
              </EmptyState>
            )
          ) : (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {items.map((item) => (
                <ItemCard key={item.id} item={item} signedIn={Boolean(user)} onToggleSave={toggleSave} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
