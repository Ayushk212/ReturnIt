import type { ReactNode } from 'react';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div role="alert" className="rounded-lg border border-line bg-surface p-8 text-center">
      <p className="font-serif text-xl">We couldn&apos;t load this.</p>
      <p className="mt-2 text-sm text-muted">{message}</p>
      {onRetry && (
        <button type="button" onClick={onRetry} className="btn-secondary mt-5">
          Try again
        </button>
      )}
    </div>
  );
}

export function EmptyState({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-line bg-surface/60 p-10 text-center">
      <p className="font-serif text-xl">{title}</p>
      {children && <div className="mx-auto mt-2 max-w-md text-sm text-muted">{children}</div>}
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="overflow-hidden rounded-lg border border-line bg-surface" aria-hidden="true">
      <div className="aspect-[4/3] animate-pulse bg-line/60" />
      <div className="space-y-3 p-4">
        <div className="h-3 w-1/3 animate-pulse rounded bg-line/60" />
        <div className="h-5 w-4/5 animate-pulse rounded bg-line/60" />
        <div className="h-3 w-full animate-pulse rounded bg-line/60" />
      </div>
    </div>
  );
}
