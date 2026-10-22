import { PackageCheck, Search } from 'lucide-react';
import type { ItemType } from '../lib/types';

interface Props {
  type: ItemType;
  /** `chip` is a solid tag; `text` is an inline coloured label. Both pair colour with an icon and a word. */
  variant?: 'chip' | 'text';
  className?: string;
}

export default function TypeLabel({ type, variant = 'chip', className = '' }: Props) {
  const lost = type === 'lost';
  const Icon = lost ? Search : PackageCheck;

  if (variant === 'text') {
    return (
      <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${lost ? 'text-coral-ink' : 'text-lime-ink'} ${className}`}>
        <Icon size={14} aria-hidden />
        {lost ? 'Lost' : 'Found'}
      </span>
    );
  }

  return (
    <span className={`chip font-semibold text-ink ${lost ? 'bg-coral' : 'bg-lime'} ${className}`}>
      <Icon size={12} strokeWidth={2.4} aria-hidden />
      {lost ? 'Lost' : 'Found'}
    </span>
  );
}
