import { Link } from 'react-router-dom';
import { ArrowRight, Plus } from 'lucide-react';
import { useAuth } from '../../context/AuthContext';
import { useSaveToggle } from '../../hooks/useSaveToggle';
import type { Item } from '../../lib/types';
import ItemCard from '../ItemCard';
import { Reveal, RevealGroup, RevealItem } from '../Motion';
import { CardSkeleton, EmptyState, ErrorState } from '../States';

interface Props {
  data: Item[] | null;
  loading: boolean;
  error: string | null;
  onRetry: () => void;
}

export default function LatestItems({ data, loading, error, onRetry }: Props) {
  const { user } = useAuth();
  const { items, toggleSave } = useSaveToggle(data);
  const latest = items.slice(0, 6);

  return (
    <section aria-labelledby="latest-heading" className="border-y border-line bg-surface/60">
      <div className="container-page py-20 sm:py-28">
        <Reveal className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <p className="eyebrow text-muted">Fresh on the board</p>
            <h2 id="latest-heading" className="mt-3 text-display-lg font-bold">Recently reported</h2>
          </div>
          <Link to="/dashboard" className="btn-secondary">
            View the full board <ArrowRight size={16} aria-hidden />
          </Link>
        </Reveal>

        <div className="mt-10">
          {loading && !data ? (
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3" role="status" aria-label="Loading listings">
              {Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}
            </div>
          ) : error ? (
            <ErrorState message={error} onRetry={onRetry} />
          ) : latest.length === 0 ? (
            <EmptyState title="Nothing has been posted yet">
              <p>New reports will appear here as soon as they are posted.</p>
              <Link to="/post" className="btn-primary mt-5">
                <Plus size={16} aria-hidden /> Post an item
              </Link>
            </EmptyState>
          ) : (
            <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {latest.map((item) => (
                <RevealItem key={item.id}>
                  <ItemCard item={item} signedIn={Boolean(user)} onToggleSave={toggleSave} />
                </RevealItem>
              ))}
            </RevealGroup>
          )}
        </div>
      </div>
    </section>
  );
}
