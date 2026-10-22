import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';

interface ConfirmOptions {
  title: string;
  body?: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
}

interface Pending extends ConfirmOptions {
  resolve: (ok: boolean) => void;
}

/**
 * Promise-based replacement for window.confirm, built on the native <dialog> element
 * (which provides focus trapping, Escape to cancel and an inert background).
 */
export function useConfirm() {
  const [pending, setPending] = useState<Pending | null>(null);

  const confirm = useCallback(
    (options: ConfirmOptions) => new Promise<boolean>((resolve) => setPending({ ...options, resolve })),
    [],
  );

  const close = useCallback(
    (ok: boolean) => {
      pending?.resolve(ok);
      setPending(null);
    },
    [pending],
  );

  const dialog = pending ? <ConfirmDialog {...pending} onClose={close} /> : null;
  return { confirm, dialog };
}

function ConfirmDialog({ title, body, confirmLabel = 'Confirm', cancelLabel = 'Cancel', onClose }: ConfirmOptions & { onClose: (ok: boolean) => void }) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  return (
    <dialog
      ref={ref}
      aria-labelledby="confirm-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose(false);
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose(false);
      }}
      className="m-auto w-[min(28rem,calc(100vw-2rem))] animate-dialog-in rounded-panel border border-line bg-surface p-0 text-ink shadow-pop"
    >
      <div className="p-6 sm:p-7">
        <h2 id="confirm-title" className="text-xl font-semibold tracking-tight">{title}</h2>
        {body && <div className="mt-2 text-sm leading-relaxed text-muted">{body}</div>}
        <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <button type="button" onClick={() => onClose(false)} className="btn-secondary">
            {cancelLabel}
          </button>
          <button type="button" onClick={() => onClose(true)} className="btn-ink">
            {confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
