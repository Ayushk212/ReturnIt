import { Link } from 'react-router-dom';
import { ArrowUpRight, Bookmark, Lock, MapPin } from 'lucide-react';
import { categoryLabel } from '../lib/categoryMeta';
import { timeAgo } from '../lib/format';
import type { Item } from '../lib/types';
import ItemImage from './ItemImage';
import { ItemStatusBadge } from './StatusBadge';
import TypeLabel from './TypeLabel';

interface Props {
  item: Item;
  signedIn: boolean;
  onToggleSave: (item: Item) => void;
}

export default function ItemCard({ item, signedIn, onToggleSave }: Props) {
  return (
    <article className="group relative flex h-full flex-col rounded-card border border-line bg-surface p-2 transition duration-300 ease-out hover:-translate-y-1 hover:border-line-strong hover:shadow-lift">
      <div className="relative aspect-[4/3] overflow-hidden rounded-[0.9rem] bg-paper">
        <ItemImage item={item} thumb className="h-full w-full transition-transform duration-700 ease-out group-hover:scale-[1.04]" />
        <div className="pointer-events-none absolute inset-x-3 top-3 flex items-start gap-1.5">
          <TypeLabel type={item.type} />
          {item.status !== 'open' && <ItemStatusBadge status={item.status} />}
        </div>
        <button
          type="button"
          onClick={() => onToggleSave(item)}
          aria-pressed={item.saved}
          aria-label={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          className={`absolute right-2.5 top-2.5 z-10 grid h-9 w-9 place-items-center rounded-full border backdrop-blur transition duration-200 hover:scale-105 active:scale-95 ${
            item.saved ? 'border-ink bg-ink text-lime' : 'border-white/60 bg-surface/90 text-ink hover:bg-surface'
          }`}
        >
          <Bookmark size={15} className={item.saved ? 'fill-current' : ''} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col px-2.5 pb-2 pt-3.5">
        <div className="eyebrow flex items-center justify-between gap-2 text-muted">
          <span className="truncate">{categoryLabel(item.category)}</span>
          <span className="shrink-0">{timeAgo(item.createdAt)}</span>
        </div>

        <h3 className="mt-2 text-[1.15rem] font-semibold leading-snug tracking-[-0.02em]">
          <Link to={`/items/${item.id}`} className="outline-none after:absolute after:inset-0 after:rounded-card focus-visible:after:outline focus-visible:after:outline-2 focus-visible:after:outline-cobalt">
            {item.title}
          </Link>
        </h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-muted">{item.description}</p>

        <div className="mt-auto pt-4">
          <div className="perforation" aria-hidden />
        </div>
        <div className="flex items-center justify-between gap-2 pt-3 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={14} aria-hidden className="shrink-0 text-ink-soft" />
            <span className="truncate">{item.locationLabel}</span>
          </span>
          {signedIn ? (
            <ArrowUpRight size={16} aria-hidden className="shrink-0 text-ink transition-transform duration-300 group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          ) : (
            <span className="flex shrink-0 items-center gap-1">
              <Lock size={12} aria-hidden /> Sign in to open
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
