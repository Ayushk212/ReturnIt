import { useEffect, useRef, useState, type FormEvent } from 'react';
import { AlertCircle, CircleCheck, Flag } from 'lucide-react';
import { api } from '../lib/api';
import type { ReportReason } from '../lib/types';

const REASONS: { value: ReportReason; label: string }[] = [
  { value: 'spam', label: 'Spam or advertising' },
  { value: 'fake_claim', label: 'Misleading or false listing' },
  { value: 'prohibited_item', label: 'Prohibited item' },
  { value: 'inappropriate_content', label: 'Inappropriate content' },
  { value: 'harassment', label: 'Harassment or abuse' },
  { value: 'other', label: 'Something else' },
];

export default function ReportDialog({ itemId, onClose }: { itemId: string; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const [reason, setReason] = useState<ReportReason>('spam');
  const [details, setDetails] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (el && !el.open) el.showModal();
    return () => el?.close();
  }, []);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (details.trim().length < 10) {
      setError('Add a few details (at least 10 characters).');
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await api.reportItem(itemId, reason, details.trim());
      setDone(res.alreadyReported ? 'You have already reported this listing. Thank you.' : 'Thank you. The report has been sent for review.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not send the report.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby="report-title"
      onCancel={(e) => {
        e.preventDefault();
        onClose();
      }}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      className="m-auto w-[min(30rem,calc(100vw-2rem))] animate-dialog-in rounded-panel border border-line bg-surface p-0 text-ink shadow-pop"
    >
      <form onSubmit={submit} className="p-6 sm:p-7">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-danger-soft text-danger" aria-hidden><Flag size={18} /></span>
        <h2 id="report-title" className="mt-4 text-xl font-semibold tracking-tight">Report this listing</h2>
        {done ? (
          <>
            <p role="status" className="mt-3 flex gap-2 text-sm text-lime-ink"><CircleCheck size={17} aria-hidden className="shrink-0" /> {done}</p>
            <div className="mt-7 flex justify-end">
              <button type="button" onClick={onClose} className="btn-ink">Close</button>
            </div>
          </>
        ) : (
          <>
            <p className="mt-2 text-sm text-muted">Reports are reviewed by moderators. The person who posted the listing is not told who reported it.</p>
            <fieldset className="mt-5">
              <legend className="label">Reason</legend>
              <div className="grid gap-2">
                {REASONS.map((r) => (
                  <label key={r.value} className={`flex cursor-pointer items-center gap-3 rounded-xl border px-3 py-2.5 text-sm transition-colors ${reason === r.value ? 'border-ink bg-paper' : 'border-line hover:border-line-strong'}`}>
                    <input type="radio" name="reason" value={r.value} checked={reason === r.value} onChange={() => setReason(r.value)} className="accent-ink" />
                    {r.label}
                  </label>
                ))}
              </div>
            </fieldset>
            <div className="mt-5">
              <label htmlFor="report-details" className="label">Details</label>
              <textarea id="report-details" rows={3} maxLength={1000} className="field" value={details} onChange={(e) => setDetails(e.target.value)} placeholder="Describe what is wrong with this listing." />
            </div>
            {error && <p role="alert" className="mt-3 flex items-center gap-1.5 text-sm font-medium text-danger"><AlertCircle size={14} aria-hidden /> {error}</p>}
            <div className="mt-7 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={onClose} className="btn-secondary">Cancel</button>
              <button type="submit" disabled={busy} className="btn-ink">{busy ? 'Sending…' : 'Send report'}</button>
            </div>
          </>
        )}
      </form>
    </dialog>
  );
}
