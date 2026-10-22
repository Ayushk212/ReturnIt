import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { m } from 'motion/react';
import { Clock, LayoutGrid, PackageCheck, Plus, RefreshCw, Search } from 'lucide-react';
import ItemCard from '../components/ItemCard';
import { RevealGroup, RevealItem } from '../components/Motion';
import PageBanner from '../components/PageBanner';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useSaveToggle } from '../hooks/useSaveToggle';
import { api } from '../lib/api';
import { categoryLabel } from '../lib/categoryMeta';
import { spring } from '../lib/motion';
import type { Item } from '../lib/types';

type FilterType = 'all' | 'lost' | 'found';

const FILTERS: { value: FilterType; label: string; icon: typeof LayoutGrid }[] = [
  { value: 'all', label: 'All reports', icon: LayoutGrid },
  { value: 'lost', label: 'Lost', icon: Search },
  { value: 'found', label: 'Found', icon: PackageCheck },
];

function groupLabel(iso: string): string {
  const created = new Date(iso);
  const startOfToday = new Date();
  startOfToday.setHours(0, 0, 0, 0);
  const day = 86_400_000;
  if (created >= startOfToday) return 'Today';
  if (created.getTime() >= startOfToday.getTime() - day) return 'Yesterday';
  if (created.getTime() >= startOfToday.getTime() - 6 * day) return 'Earlier this week';
  return 'Older reports';
}

export default function Recent() {
  const { user } = useAuth();
  const [filterType, setFilterType] = useState<FilterType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const { data, loading, error, reload } = useAsync((signal) => api.listItems({}, signal), []);
  const { items, toggleSave } = useSaveToggle(data);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return items.filter((item) => {
      if (filterType !== 'all' && item.type !== filterType) return false;
      if (!q) return true;
      return [item.title, item.description, item.locationLabel, categoryLabel(item.category)].some((v) => v.toLowerCase().includes(q));
    });
  }, [items, filterType, searchQuery]);

  const groups = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const item of filtered) {
      const label = groupLabel(item.createdAt);
      map.set(label, [...(map.get(label) ?? []), item]);
    }
    return [...map.entries()];
  }, [filtered]);

  const filtering = Boolean(searchQuery.trim()) || filterType !== 'all';

  return (
    <div className="pb-24">
      <PageBanner
        eyebrow={<><Clock size={14} aria-hidden /> Campus feed</>}
        title={<>Recently <span className="font-serif font-normal italic text-lime">reported</span></>}
        description="The newest lost and found reports from across MNNIT, in the order they were posted. Check back regularly; new items appear here first."
        actions={
          <>
            <Link to="/post" className="btn-lime"><Plus size={16} strokeWidth={2.5} aria-hidden /> Post an item</Link>
            <button type="button" onClick={reload} disabled={loading} className="btn-glass">
              <RefreshCw size={15} className={loading ? 'animate-spin' : ''} aria-hidden /> Refresh
            </button>
          </>
        }
      />

      <div className="container-page">
        <div className="relative z-30 -mt-7 flex flex-col gap-2 rounded-[1.5rem] border border-line bg-surface/95 p-2 shadow-lift backdrop-blur-xl sm:flex-row sm:items-center lg:sticky lg:top-[5.25rem]">
          <div role="group" aria-label="Report type" className="inline-flex shrink-0 rounded-full bg-paper p-1">
            {FILTERS.map((f) => {
              const on = filterType === f.value;
              return (
                <button
                  key={f.value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => setFilterType(f.value)}
                  className={`relative rounded-full px-4 py-2 text-sm font-semibold transition-colors ${on ? 'text-white' : 'text-muted hover:text-ink'}`}
                >
                  {on && <m.span layoutId="recent-pill" transition={spring} className="absolute inset-0 rounded-full bg-ink" aria-hidden />}
                  <span className="relative flex items-center gap-1.5"><f.icon size={14} aria-hidden /> {f.label}</span>
                </button>
              );
            })}
          </div>
          <div className="relative flex-1">
            <label htmlFor="recent-search" className="sr-only">Filter recent reports</label>
            <Search size={17} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
            <input
              id="recent-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter by keyword, place or category"
              className="field h-11 rounded-full border-transparent bg-paper pl-11 hover:border-line focus:bg-surface"
            />
          </div>
        </div>

        <p className="mt-6 text-sm font-semibold" aria-live="polite">
          {loading && !data ? 'Loading reports…' : error ? '' : `${filtered.length} ${filtered.length === 1 ? 'report' : 'reports'}${filtering ? ' match your filters' : ''}`}
        </p>

        <div className="mt-4">
          {loading && !data ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading recent reports">
              {Array.from({ length: 6 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={reload} />
          ) : filtered.length === 0 ? (
            <EmptyState title={filtering ? 'No reports match your filters' : 'No reports yet'}>
              <p>{filtering ? 'Try a broader keyword or show all report types.' : 'There are no reports yet. New lost and found reports will appear here first.'}</p>
              <div className="mt-5 flex flex-wrap justify-center gap-3">
                {filtering && (
                  <button type="button" onClick={() => { setSearchQuery(''); setFilterType('all'); }} className="btn-secondary">Clear filters</button>
                )}
                <Link to="/post" className="btn-primary"><Plus size={16} aria-hidden /> Post an item</Link>
              </div>
            </EmptyState>
          ) : (
            <div className="space-y-12">
              {groups.map(([label, list]) => (
                <section key={label} aria-labelledby={`group-${label}`}>
                  <h2 id={`group-${label}`} className="flex items-baseline gap-3 border-b border-line pb-3 text-xl font-semibold tracking-tight">
                    {label} <span className="font-mono text-xs font-normal text-muted">{list.length}</span>
                  </h2>
                  <RevealGroup className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                    {list.map((item) => (
                      <RevealItem key={item.id}>
                        <ItemCard item={item} signedIn={Boolean(user)} onToggleSave={toggleSave} />
                      </RevealItem>
                    ))}
                  </RevealGroup>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
