import { PackageCheck, Search } from 'lucide-react';
import type { ItemType } from '../lib/types';

export default function TypeLabel({ type }: { type: ItemType }) {
  const lost = type === 'lost';
  const Icon = lost ? Search : PackageCheck;
  return (
    <span className={`inline-flex items-center gap-1.5 text-sm font-semibold ${lost ? 'text-lost' : 'text-accent'}`}>
      <Icon size={14} aria-hidden />
      {lost ? 'Lost' : 'Found'}
    </span>
  );
}
