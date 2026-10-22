import { claimStatusLabel, statusLabel } from '../lib/format';
import type { ClaimStatus, ItemStatus } from '../lib/types';

const ITEM_DOT: Record<ItemStatus, string> = {
  open: 'bg-lime-ink',
  claim_pending: 'bg-amber-500',
  resolved: 'bg-cobalt',
  expired: 'bg-muted',
  removed: 'bg-muted',
};

const CLAIM_DOT: Record<ClaimStatus, string> = {
  pending: 'bg-amber-500',
  approved: 'bg-lime-ink',
  rejected: 'bg-danger',
  withdrawn: 'bg-muted',
};

const base = 'chip border border-line bg-surface/95 text-ink-soft backdrop-blur';

export function ItemStatusBadge({ status, className = '' }: { status: ItemStatus; className?: string }) {
  return (
    <span className={`${base} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${ITEM_DOT[status]}`} />
      {statusLabel(status)}
    </span>
  );
}

export function ClaimStatusBadge({ status, className = '' }: { status: ClaimStatus; className?: string }) {
  return (
    <span className={`${base} ${className}`}>
      <span aria-hidden className={`h-1.5 w-1.5 rounded-full ${CLAIM_DOT[status]}`} />
      {claimStatusLabel(status)}
    </span>
  );
}
