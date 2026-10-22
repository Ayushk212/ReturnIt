import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { m } from 'motion/react';
import { LayoutGrid, Lock, MapPin, PackageCheck, Plus, Search, X, type LucideIcon } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useSaveToggle } from '../hooks/useSaveToggle';
import { api } from '../lib/api';
import { categoryLabel, categoryMeta } from '../lib/categoryMeta';
import { CATEGORIES, LOCATIONS } from '../lib/constants';
import { fadeUp, spring } from '../lib/motion';
import type { ItemType } from '../lib/types';

const TABS: { value: '' | ItemType; label: string; icon: LucideIcon }[] = [
  { value: '', label: 'All', icon: LayoutGrid },
  { value: 'lost', label: 'Lost', icon: Search },
  { value: 'found', label: 'Found', icon: PackageCheck },
];

const chipClass = (on: boolean) =>
  `inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3.5 py-2 text-[13px] font-medium transition-colors duration-200 ${
    on ? 'border-ink bg-ink text-white' : 'border-line bg-surface text-ink-soft hover:border-line-strong hover:text-ink'
  }`;

export default function Dashboard() {
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const rawType = params.get('type');
  const type: ItemType | undefined = rawType === 'lost' || rawType === 'found' ? rawType : undefined;
  const category = params.get('category') ?? '';
  const place = params.get('location') ?? '';
  const q = params.get('q') ?? '';

  const [search, setSearch] = useState(q);

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
  }, [search]);

  const { data, loading, error, reload } = useAsync(
    (signal) => api.listItems({ type, category: category || undefined, location: place || undefined, q: q || undefined }, signal),
    [type, category, place, q, user?.uid],
  );

  const { items, toggleSave } = useSaveToggle(data);
  const filtersActive = Boolean(type || category || place || q);

  function clearFilters() {
    setSearch('');
    setParams({}, { replace: true });
  }

  const activeFilters = [
    type && { key: 'type', label: type === 'lost' ? 'Lost items' : 'Found items', clear: () => setParam('type', '') },
    category && { key: 'category', label: categoryLabel(category), clear: () => setParam('category', '') },
    place && { key: 'location', label: place, clear: () => setParam('location', '') },
    q && {
      key: 'q',
      label: `“${q}”`,
      clear: () => {
        setSearch('');
        setParam('q', '');
      },
    },
  ].filter((f): f is { key: string; label: string; clear: () => void } => Boolean(f));

  return (
    <div>
      <section className="container-page">
        <header className="grid gap-6 pb-8 lg:grid-cols-12 lg:items-end">
          <div className="lg:col-span-8">
            <p className="eyebrow text-muted">Campus board · MNNIT Allahabad</p>
            <h1 className="mt-3 text-display-xl font-bold">
              Everything <span className="mark-lost">lost</span> &amp; <span className="mark-found">found</span> on campus.
            </h1>
            <p className="mt-4 max-w-xl text-muted">All active lost and found reports at MNNIT. Listings are visible to everyone; opening one requires a campus account.</p>
          </div>
          <div className="lg:col-span-4 lg:justify-self-end">
            <Link to="/post" className="btn-primary btn-lg">
              <Plus size={18} aria-hidden /> Post an item
            </Link>
          </div>
        </header>

        {!user && (
          <div className="mb-6 flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-line bg-surface px-4 py-3.5 text-sm sm:px-5">
            <p className="flex items-center gap-3 text-muted">
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-cobalt-soft text-cobalt-ink" aria-hidden>
                <Lock size={16} />
              </span>
              <span>
                Sign in with your <span className="font-semibold text-ink">@mnnit.ac.in</span> account to open listings, send a request, save items or post.
              </span>
            </p>
            <Link to="/signin" state={{ from: '/dashboard' }} className="btn-ink btn-sm">
              Sign in
            </Link>
          </div>
        )}
      </section>

      <section className="container-page pb-24">
        <div className="z-30 rounded-[1.5rem] border border-line bg-surface/90 p-2 shadow-lift backdrop-blur-xl lg:sticky lg:top-[5.25rem]">
          <div className="flex flex-wrap items-center gap-2">
            <div role="group" aria-label="Listing type" className="inline-flex shrink-0 rounded-full bg-paper p-1">
              {TABS.map((t) => {
                const on = (type ?? '') === t.value;
                return (
                  <button
                    key={t.label}
                    type="button"
                    aria-pressed={on}
                    onClick={() => setParam('type', t.value)}
                    className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? 'text-white' : 'text-muted hover:text-ink'}`}
                  >
                    {on && <m.span layoutId="type-pill" transition={spring} className="absolute inset-0 rounded-full bg-ink" aria-hidden />}
                    <span className="relative flex items-center gap-1.5">
                      <t.icon size={14} aria-hidden /> {t.label}
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="relative min-w-[14rem] flex-1">
              <label htmlFor="search" className="sr-only">Search listings</label>
              <Search size={17} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <input
                id="search"
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by item, place or description"
                className="field h-11 rounded-full border-transparent bg-paper pl-11 hover:border-line focus:bg-surface"
              />
            </div>

            <div className="relative w-full sm:w-auto">
              <label htmlFor="place" className="sr-only">Location</label>
              <MapPin size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
              <select
                id="place"
                value={place}
                onChange={(e) => setParam('location', e.target.value)}
                className="field h-11 w-full rounded-full border-transparent bg-paper pl-10 hover:border-line sm:w-56"
              >
                <option value="">All locations</option>
                {LOCATIONS.map((l) => (
                  <option key={l} value={l}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div role="group" aria-label="Category" className="scrollbar-none mt-2 flex gap-1.5 overflow-x-auto px-0.5 pb-0.5">
            <button type="button" aria-pressed={!category} onClick={() => setParam('category', '')} className={chipClass(!category)}>
              All categories
            </button>
            {CATEGORIES.map((c) => {
              const Icon = categoryMeta(c.value).icon;
              const on = category === c.value;
              return (
                <button key={c.value} type="button" aria-pressed={on} onClick={() => setParam('category', on ? '' : c.value)} className={chipClass(on)}>
                  <Icon size={14} aria-hidden /> {c.label}
                </button>
              );
            })}
          </div>
        </div>

        <div className="mt-6 flex min-h-[2.25rem] flex-wrap items-center gap-2">
          <p className="mr-2 font-display text-lg font-semibold tracking-tight" aria-live="polite">
            {loading ? 'Loading listings…' : error ? '' : `${items.length} ${items.length === 1 ? 'listing' : 'listings'}`}
          </p>
          {activeFilters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={f.clear}
              aria-label={`Remove filter: ${f.label}`}
              className="inline-flex items-center gap-1.5 rounded-full bg-cobalt-soft py-1.5 pl-3 pr-2 text-[13px] font-medium text-cobalt-ink transition-colors hover:bg-cobalt hover:text-white"
            >
              {f.label} <X size={14} aria-hidden />
            </button>
          ))}
          {filtersActive && (
            <button type="button" onClick={clearFilters} className="ml-1 text-[13px] font-semibold text-muted underline-offset-4 hover:text-ink hover:underline">
              Clear filters
            </button>
          )}
        </div>

        <div className="mt-5">
          {loading ? (
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))]">
              {Array.from({ length: 8 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : items.length === 0 ? (
            filtersActive ? (
              <EmptyState title="No listings match these filters">
                <p>Try a different search, or clear the filters to see everything.</p>
                <button type="button" onClick={clearFilters} className="btn-secondary mt-5">Clear filters</button>
              </EmptyState>
            ) : (
              <EmptyState title="Nothing on the board yet" icon={<PackageCheck size={24} strokeWidth={1.8} />}>
                <p>There are no active reports. New lost and found reports will appear here.</p>
                <Link to="/post" className="btn-primary mt-5">Post an item</Link>
              </EmptyState>
            )
          ) : (
            <div className="grid gap-5 [grid-template-columns:repeat(auto-fill,minmax(16.5rem,1fr))]">
              {items.map((item, i) => (
                <m.div key={item.id} variants={fadeUp} custom={Math.min(i, 10) * 0.035 + 0.01} initial="hidden" animate="show">
                  <ItemCard item={item} signedIn={Boolean(user)} onToggleSave={toggleSave} />
                </m.div>
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
