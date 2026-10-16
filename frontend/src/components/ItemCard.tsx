import { Link } from 'react-router-dom';
import { Bookmark, Lock, MapPin } from 'lucide-react';
import { CATEGORIES } from '../lib/constants';
import { timeAgo } from '../lib/format';
import type { Item } from '../lib/types';
import ItemImage from './ItemImage';
import TypeLabel from './TypeLabel';

interface Props {
  item: Item;
  signedIn: boolean;
  onToggleSave: (item: Item) => void;
}

export default function ItemCard({ item, signedIn, onToggleSave }: Props) {
  const category = CATEGORIES.find((c) => c.value === item.category)?.label ?? 'Other';

  return (
    <article className="relative flex flex-col overflow-hidden rounded-lg border border-line bg-surface transition-shadow hover:shadow-md">
      <div className="relative aspect-[4/3] bg-paper">
        <ItemImage item={item} className="h-full w-full" />
        <button
          type="button"
          onClick={() => onToggleSave(item)}
          aria-pressed={item.saved}
          aria-label={item.saved ? `Remove ${item.title} from saved` : `Save ${item.title}`}
          className="absolute right-2 top-2 z-10 rounded-md bg-surface/95 p-2 text-ink shadow-sm hover:bg-surface"
        >
          <Bookmark size={16} className={item.saved ? 'fill-ink' : ''} aria-hidden />
        </button>
      </div>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <div className="flex items-center justify-between gap-2 text-xs text-muted">
          <span className="flex items-center gap-1.5">
            <TypeLabel type={item.type} />
            <span aria-hidden>·</span>
            <span>{category}</span>
          </span>
          <span className="shrink-0">{timeAgo(item.createdAt)}</span>
        </div>

        <h3 className="font-serif text-lg font-medium leading-snug">
          <Link to={`/items/${item.id}`} className="after:absolute after:inset-0 hover:underline">
            {item.title}
          </Link>
        </h3>
        <p className="line-clamp-2 text-sm text-muted">{item.description}</p>

        <div className="mt-auto flex items-center justify-between gap-2 border-t border-line pt-3 text-xs text-muted">
          <span className="flex min-w-0 items-center gap-1.5">
            <MapPin size={14} aria-hidden className="shrink-0" />
            <span className="truncate">{item.locationLabel}</span>
          </span>
          {!signedIn && (
            <span className="flex shrink-0 items-center gap-1">
              <Lock size={12} aria-hidden /> Sign in to open
            </span>
          )}
        </div>
      </div>
    </article>
  );
}
