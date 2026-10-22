import type { ReactNode } from 'react';
import { CloudOff, SearchX } from 'lucide-react';

export function ErrorState({ message, onRetry, title = 'We couldn’t load this.' }: { message: string; onRetry?: () => void; title?: string }) {
  return (
    <div role="alert" className="card flex flex-col items-center px-6 py-12 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-danger-soft text-danger" aria-hidden>
        <CloudOff size={24} strokeWidth={1.8} />
      </span>
      <p className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</p>
      <p className="mt-2 max-w-md text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-6">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children, icon }: { title: string; children?: ReactNode; icon?: ReactNode }) {
  return (
    <div className="relative flex flex-col items-center overflow-hidden rounded-card border border-dashed border-line-strong bg-surface/60 px-6 py-14 text-center">
      <span className="grid h-14 w-14 -rotate-6 place-items-center rounded-2xl bg-surface text-ink-soft shadow-lift ring-1 ring-ink/5" aria-hidden>
        {icon ?? <SearchX size={24} strokeWidth={1.8} />}
      </span>
      <p className="mt-5 font-display text-xl font-semibold tracking-tight">{title}</p>
      {children && <div className="mx-auto mt-2 flex max-w-md flex-col items-center text-sm text-muted">{children}</div>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="rounded-card border border-line bg-surface p-2" aria-hidden="true">
      <div className="skeleton aspect-[4/3] rounded-[0.9rem]" />
      <div className="space-y-3 px-2.5 pb-3 pt-4">
        <div className="skeleton h-2.5 w-1/3" />
        <div className="skeleton h-5 w-4/5" />
        <div className="skeleton h-3 w-full" />
        <div className="skeleton h-3 w-2/3" />
      </div>
    </div>
  );
}

export function PageLoader({ label = 'Loading…' }: { label?: string }) {
  return (
    <div className="container-page flex min-h-[60vh] items-center justify-center" role="status">
      <span className="flex items-center gap-3 text-sm font-medium text-muted">
        <span className="relative flex h-2.5 w-2.5" aria-hidden>
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-cobalt/60" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-cobalt" />
        </span>
        {label}
      </span>
    </div>
  );
}
