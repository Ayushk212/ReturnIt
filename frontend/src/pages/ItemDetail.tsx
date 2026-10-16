import { useState, type FormEvent } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Bookmark, CalendarDays, Link2, MapPin, ShieldCheck, Tag, User } from 'lucide-react';
import ItemImage from '../components/ItemImage';
import { ErrorState } from '../components/States';
import TypeLabel from '../components/TypeLabel';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { CATEGORIES } from '../lib/constants';
import { formatDate, statusLabel, timeAgo } from '../lib/format';

export default function ItemDetail() {
  const { id = '' } = useParams();
  const { data: item, loading, error, reload } = useAsync(() => api.getItem(id), [id]);

  const [active, setActive] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedLocal, setSavedLocal] = useState<boolean | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (loading && !item) {
    return (
      <div className="container-page py-12" role="status" aria-label="Loading listing">
        <div className="grid gap-10 lg:grid-cols-2">
          <div className="aspect-[4/3] animate-pulse rounded-lg bg-line/60" />
          <div className="space-y-4">
            <div className="h-4 w-1/4 animate-pulse rounded bg-line/60" />
            <div className="h-9 w-3/4 animate-pulse rounded bg-line/60" />
            <div className="h-24 w-full animate-pulse rounded bg-line/60" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container-page py-12">
        <ErrorState message={error ?? 'This listing could not be found.'} onRetry={reload} />
        <p className="mt-4 text-center text-sm">
          <Link to="/dashboard" className="font-medium text-accent hover:underline">Back to the board</Link>
        </p>
      </div>
    );
  }

  const category = CATEGORIES.find((c) => c.value === item.category)?.label ?? 'Other';
  const isSaved = savedLocal ?? item.saved;
  const closed = item.status === 'resolved' || item.status === 'expired';
  const requestPending = sent || item.myClaimStatus === 'pending';
  const isFound = item.type === 'found';

  async function toggleSave() {
    if (!item) return;
    const next = !isSaved;
    setSavedLocal(next);
    try {
      await api.toggleSave(item.id);
    } catch {
      setSavedLocal(!next);
    }
  }

  async function copyLink() {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setActionError('Could not copy the link. Copy it from the address bar instead.');
    }
  }

  async function markResolved() {
    if (!item || !window.confirm('Mark this listing as resolved? It will be closed to new requests.')) return;
    setActionError(null);
    try {
      await api.resolveItem(item.id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the listing.');
    }
  }

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!item) return;
    const text = message.trim();
    if (text.length < 10) {
      setFormError('Please write at least 10 characters.');
      return;
    }
    setBusy(true);
    setFormError(null);
    try {
      await api.submitClaim(item.id, text);
      setSent(true);
      setMessage('');
      reload();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : 'Could not send your request.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="container-page py-10">
      <nav aria-label="Breadcrumb" className="text-sm text-muted">
        <Link to="/dashboard" className="hover:text-ink">Campus board</Link>
        <span aria-hidden> / </span>
        <span className="text-ink">{item.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-2">
        <div>
          <div className="aspect-[4/3] overflow-hidden rounded-lg border border-line bg-paper">
            <ItemImage key={active} item={item} index={active} eager className="h-full w-full" />
          </div>
          {item.images.length > 1 && (
            <ul className="mt-3 flex gap-2">
              {item.images.map((img, i) => (
                <li key={img.url}>
                  <button
                    type="button"
                    onClick={() => setActive(i)}
                    aria-label={`Show photo ${i + 1}`}
                    aria-current={i === active}
                    className={`h-16 w-16 overflow-hidden rounded-md border ${i === active ? 'border-ink' : 'border-line'}`}
                  >
                    <img src={img.url} alt="" className="h-full w-full object-cover" />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div>
          <div className="flex items-center gap-3 text-sm">
            <TypeLabel type={item.type} />
            <span aria-hidden className="text-muted">·</span>
            <span className="text-muted">{statusLabel(item.status)}</span>
          </div>
          <h1 className="mt-3 text-3xl font-medium sm:text-4xl">{item.title}</h1>

          <dl className="mt-6 grid gap-3 border-y border-line py-5 text-sm">
            <div className="flex gap-3"><dt className="flex w-32 items-center gap-2 text-muted"><Tag size={14} aria-hidden /> Category</dt><dd>{category}</dd></div>
            <div className="flex gap-3"><dt className="flex w-32 items-center gap-2 text-muted"><MapPin size={14} aria-hidden /> Location</dt><dd>{item.locationLabel}</dd></div>
            <div className="flex gap-3"><dt className="flex w-32 items-center gap-2 text-muted"><CalendarDays size={14} aria-hidden /> {isFound ? 'Date found' : 'Date lost'}</dt><dd>{formatDate(item.dateOccurred)}</dd></div>
            <div className="flex gap-3"><dt className="flex w-32 items-center gap-2 text-muted"><User size={14} aria-hidden /> Posted by</dt><dd>{item.owner.name}, {timeAgo(item.createdAt)}</dd></div>
          </dl>

          <p className="mt-5 whitespace-pre-line text-[15px] leading-relaxed">{item.description}</p>

          <div className="mt-5 flex flex-wrap gap-2">
            <button type="button" onClick={toggleSave} aria-pressed={isSaved} className="btn-secondary">
              <Bookmark size={16} className={isSaved ? 'fill-ink' : ''} aria-hidden /> {isSaved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={copyLink} className="btn-secondary">
              <Link2 size={16} aria-hidden /> {copied ? 'Link copied' : 'Copy link'}
            </button>
          </div>
          {actionError && <p role="alert" className="mt-3 text-sm text-lost">{actionError}</p>}

          <section aria-labelledby="action-heading" className="mt-8 rounded-lg border border-line bg-surface p-6">
            {item.isOwner ? (
              <>
                <h2 id="action-heading" className="text-xl font-medium">This is your listing</h2>
                <p className="mt-2 text-sm text-muted">Requests from other members appear under My account. Once the item is back with its owner, close the listing.</p>
                <div className="mt-4 flex flex-wrap gap-2">
                  <Link to="/profile?tab=claims" className="btn-secondary">View requests</Link>
                  {!closed && <button type="button" onClick={markResolved} className="btn-primary">Mark as resolved</button>}
                </div>
              </>
            ) : closed ? (
              <>
                <h2 id="action-heading" className="text-xl font-medium">This listing is closed</h2>
                <p className="mt-2 text-sm text-muted">It has been {item.status === 'resolved' ? 'resolved' : 'taken down because it expired'}, so it no longer accepts requests.</p>
              </>
            ) : item.myClaimStatus === 'approved' ? (
              <>
                <h2 id="action-heading" className="text-xl font-medium">Your request was approved</h2>
                <p className="mt-2 text-sm text-muted">Contact details are now available under your requests.</p>
                <Link to="/profile?tab=claims" className="btn-primary mt-4">See contact details</Link>
              </>
            ) : requestPending ? (
              <>
                <h2 id="action-heading" className="text-xl font-medium">Request sent</h2>
                <p className="mt-2 text-sm text-muted">The owner of this listing will review it. Your contact details are shared only if they approve.</p>
              </>
            ) : item.myClaimStatus === 'rejected' ? (
              <>
                <h2 id="action-heading" className="text-xl font-medium">Your last request was declined</h2>
                <p className="mt-2 text-sm text-muted">If you think this was a mistake, contact the owner through the campus or report the listing to a warden.</p>
              </>
            ) : (
              <form onSubmit={submit} noValidate>
                <h2 id="action-heading" className="text-xl font-medium">{isFound ? 'Is this yours?' : 'Have you found this?'}</h2>
                <label htmlFor="claim-message" className="label mt-4">
                  {isFound ? item.verificationQuestion ?? 'Describe the item so the finder can confirm it is yours' : 'Where did you find it, and how can you hand it over?'}
                </label>
                <textarea
                  id="claim-message"
                  rows={4}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? 'claim-error' : undefined}
                  className="field"
                />
                {formError && <p id="claim-error" role="alert" className="mt-2 text-sm text-lost">{formError}</p>}
                <button type="submit" disabled={busy} className="btn-primary mt-4">
                  {busy ? 'Sending…' : isFound ? 'Send claim' : 'Offer to return it'}
                </button>
                <p className="mt-3 flex gap-2 text-xs text-muted">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0" aria-hidden />
                  Your email and phone stay private until the owner approves your request.
                </p>
              </form>
            )}
          </section>

          <aside className="mt-4 rounded-md bg-accent-soft p-4 text-sm text-accent-dark">
            <p className="font-medium">Safety tip</p>
            <p className="mt-1">Meet in a public place on campus and never share OTPs or passwords.</p>
          </aside>
        </div>
      </div>
    </div>
  );
}
