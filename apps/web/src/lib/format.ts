import type { ClaimStatus, ItemStatus } from './types';

const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

const STEPS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31_536_000],
  ['month', 2_592_000],
  ['week', 604_800],
  ['day', 86_400],
  ['hour', 3_600],
  ['minute', 60],
];

export function timeAgo(iso: string): string {
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const abs = Math.abs(diff);
  for (const [unit, seconds] of STEPS) {
    if (abs >= seconds) return rtf.format(Math.round(diff / seconds), unit);
  }
  return 'just now';
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function statusLabel(status: ItemStatus): string {
  switch (status) {
    case 'open':
      return 'Open';
    case 'claim_pending':
      return 'Request pending';
    case 'resolved':
      return 'Resolved';
    case 'expired':
      return 'Expired';
  }
}

export function claimStatusLabel(status: ClaimStatus): string {
  switch (status) {
    case 'pending':
      return 'Awaiting decision';
    case 'approved':
      return 'Approved';
    case 'rejected':
      return 'Declined';
    case 'withdrawn':
      return 'Withdrawn';
  }
}
