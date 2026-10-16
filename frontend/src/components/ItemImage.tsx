import { useState } from 'react';
import { BookOpen, Briefcase, FileText, Gem, KeyRound, Package, Shirt, Smartphone, type LucideIcon } from 'lucide-react';
import type { Item } from '../lib/types';

const ICONS: Record<string, LucideIcon> = {
  electronics: Smartphone,
  documents: FileText,
  'wallets-bags': Briefcase,
  keys: KeyRound,
  jewelry: Gem,
  clothing: Shirt,
  books: BookOpen,
  other: Package,
};

interface Props {
  item: Item;
  index?: number;
  eager?: boolean;
  className?: string;
}

export default function ItemImage({ item, index = 0, eager = false, className = '' }: Props) {
  const [failed, setFailed] = useState(false);
  const image = item.images[index];

  if (image && !failed) {
    return (
      <img
        src={image.url}
        alt={image.alt}
        loading={eager ? 'eager' : 'lazy'}
        decoding="async"
        onError={() => setFailed(true)}
        className={`object-cover ${className}`}
      />
    );
  }

  const Icon = ICONS[item.category] ?? Package;
  return (
    <div
      role="img"
      aria-label={`No photo provided for ${item.title}`}
      className={`flex items-center justify-center text-muted ${className}`}
      style={{
        backgroundColor: '#EFEBE0',
        backgroundImage: 'repeating-linear-gradient(135deg, rgba(22,25,29,0.05) 0 1px, transparent 1px 12px)',
      }}
    >
      <Icon size={36} strokeWidth={1.25} aria-hidden />
    </div>
  );
}
