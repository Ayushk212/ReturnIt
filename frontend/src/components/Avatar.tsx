import { useState } from 'react';
import { initialsOf } from '../lib/initials';

const SIZES = {
  xs: 'h-7 w-7 text-[10px]',
  sm: 'h-9 w-9 text-xs',
  md: 'h-11 w-11 text-sm',
  lg: 'h-16 w-16 text-xl',
  xl: 'h-24 w-24 text-3xl sm:h-28 sm:w-28',
} as const;

// A stable tint per person so initials avatars are distinguishable in lists.
const TINTS = ['bg-cobalt-soft text-cobalt-ink', 'bg-lime-soft text-lime-ink', 'bg-coral-soft text-coral-ink', 'bg-paper-deep text-ink-soft'];

function tintFor(seed: string): string {
  let h = 0;
  for (let i = 0; i < seed.length; i += 1) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

interface Props {
  name: string;
  src?: string;
  size?: keyof typeof SIZES;
  className?: string;
}

export default function Avatar({ name, src, size = 'md', className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const base = `inline-grid shrink-0 place-items-center overflow-hidden rounded-full font-display font-bold ${SIZES[size]} ${className}`;
  if (src && !failed) {
    return <img src={src} alt="" loading="lazy" decoding="async" onError={() => setFailed(true)} className={`${base} object-cover`} referrerPolicy="no-referrer" />;
  }
  return (
    <span aria-hidden className={`${base} ${tintFor(name)}`}>
      {initialsOf(name)}
    </span>
  );
}
