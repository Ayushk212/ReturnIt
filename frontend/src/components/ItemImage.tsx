import { useState } from 'react';
import { TONE_CLASSES, categoryMeta } from '../lib/categoryMeta';
import type { Item } from '../lib/types';

type Size = 'xs' | 'md' | 'lg';

const TILE: Record<Size, { tile: string; icon: number }> = {
  xs: { tile: 'h-9 w-9 rounded-lg', icon: 18 },
  md: { tile: 'h-20 w-20 rounded-2xl', icon: 34 },
  lg: { tile: 'h-32 w-32 rounded-[1.75rem] sm:h-40 sm:w-40', icon: 60 },
};

/** Illustrated stand-in used when a listing has no photo: a category "sticker" on a tinted dot grid. */
export function CategoryArt({ category, label, size = 'md', className = '' }: { category: string; label: string; size?: Size; className?: string }) {
  const { icon: Icon, tone } = categoryMeta(category);
  const t = TONE_CLASSES[tone];
  const s = TILE[size];
  return (
    <div role="img" aria-label={label} className={`relative flex items-center justify-center overflow-hidden ${t.surface} ${className}`}>
      {size !== 'xs' && (
        <div
          aria-hidden
          className={`absolute inset-0 ${t.dot}`}
          style={{ backgroundImage: 'radial-gradient(currentColor 1.2px, transparent 1.3px)', backgroundSize: '16px 16px' }}
        />
      )}
      <div
        aria-hidden
        className={`relative grid -rotate-6 place-items-center bg-surface shadow-[0_14px_30px_-14px_rgba(11,16,32,0.45)] ring-1 ring-ink/5 transition-transform duration-500 ease-out group-hover:-rotate-2 group-hover:scale-105 ${s.tile} ${t.ink}`}
      >
        <Icon size={s.icon} strokeWidth={1.5} />
      </div>
      {size === 'lg' && <span className="eyebrow absolute bottom-4 left-4 text-ink/45">No photo provided</span>}
    </div>
  );
}

interface Props {
  item: Item;
  index?: number;
  eager?: boolean;
  size?: Size;
  /** Use the small rendition (cards, lists). */
  thumb?: boolean;
  className?: string;
}

export default function ItemImage({ item, index = 0, eager = false, size = 'md', thumb = false, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const image = item.images[index];

  if (image && !failed) {
    return (
      <img
        src={thumb ? image.thumbUrl ?? image.url : image.url}
        alt={image.alt}
        width={image.width}
        height={image.height}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  return <CategoryArt category={item.category} label={`No photo provided for ${item.title}`} size={size} className={className} />;
}
