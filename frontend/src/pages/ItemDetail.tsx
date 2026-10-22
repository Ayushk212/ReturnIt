import { useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { m } from 'motion/react';
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  CalendarDays,
  Check,
  CircleSlash,
  Flag,
  Hourglass,
  Link2,
  MapPin,
  MessageCircle,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  Tag,
  UserCheck,
  XCircle,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useConfirm } from '../components/ConfirmDialog';
import ItemCard from '../components/ItemCard';
import ItemImage from '../components/ItemImage';
import { RevealGroup, RevealItem } from '../components/Motion';
import ReportDialog from '../components/ReportDialog';
import { ErrorState } from '../components/States';
import { ItemStatusBadge } from '../components/StatusBadge';
import TypeLabel from '../components/TypeLabel';
import { useAsync } from '../hooks/useAsync';
import { useSaveToggle } from '../hooks/useSaveToggle';
import { api } from '../lib/api';
import { categoryLabel } from '../lib/categoryMeta';
import { formatDate, timeAgo } from '../lib/format';
import { EASE_OUT } from '../lib/motion';

function StatePanel({ icon: Icon, tone, title, children }: { icon: LucideIcon; tone: string; title: string; children: ReactNode }) {
  return (
    <div className="flex gap-4">
      <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${tone}`} aria-hidden>
        <Icon size={20} strokeWidth={1.8} />
      </span>
      <div className="min-w-0 flex-1">
        <h2 id="action-heading" className="text-xl font-semibold tracking-tight">{title}</h2>
        {children}
      </div>
    </div>
  );
}

export default function ItemDetail() {
  const { id = '' } = useParams();
  const { data: item, loading, error, reload } = useAsync(() => api.getItem(id), [id]);
  const { confirm, dialog } = useConfirm();

  const [active, setActive] = useState(0);
  const [message, setMessage] = useState('');
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [copied, setCopied] = useState(false);
  const [savedLocal, setSavedLocal] = useState<boolean | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [reporting, setReporting] = useState(false);
  const [chatBusy, setChatBusy] = useState(false);
  const navigate = useNavigate();
  const matches = useAsync(() => api.getMatches(id), [id]);
  const { items: matchItems, toggleSave: toggleMatchSave } = useSaveToggle(matches.data);

  if (loading && !item) {
    return (
      <div className="container-page pb-24" role="status" aria-label="Loading listing">
        <div className="skeleton h-4 w-40" />
        <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
          <div className="skeleton aspect-[4/3] rounded-panel lg:col-span-7" />
          <div className="space-y-4 lg:col-span-5">
            <div className="skeleton h-3 w-1/3" />
            <div className="skeleton h-12 w-4/5" />
            <div className="skeleton h-32 w-full rounded-2xl" />
            <div className="skeleton h-20 w-full" />
            <div className="skeleton h-48 w-full rounded-panel" />
          </div>
        </div>
      </div>
    );
  }

  if (error || !item) {
    return (
      <div className="container-page pb-24">
        <ErrorState title="This listing isn’t available." message={error ?? 'This listing could not be found.'} onRetry={reload} />
        <p className="mt-6 text-center text-sm">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 font-semibold text-cobalt hover:underline">
            <ArrowLeft size={16} aria-hidden /> Back to the board
          </Link>
        </p>
      </div>
    );
  }

  const category = categoryLabel(item.category);
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
    if (!item) return;
    const ok = await confirm({
      title: 'Mark this listing as returned?',
      body: 'It will close and stop accepting new requests.',
      confirmLabel: 'Mark as returned',
    });
    if (!ok) return;
    setActionError(null);
    try {
      await api.resolveItem(item.id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the listing.');
    }
  }

  async function openChat() {
    if (!item) return;
    setChatBusy(true);
    setActionError(null);
    try {
      const convo = await api.startConversation(item.id);
      navigate(`/messages/${convo.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the conversation.');
      setChatBusy(false);
    }
  }

  async function renew() {
    if (!item) return;
    setActionError(null);
    try {
      await api.renewItem(item.id);
      reload();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not renew the listing.');
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

  const facts: { icon: LucideIcon; label: string; value: string }[] = [
    { icon: Tag, label: 'Category', value: category },
    { icon: MapPin, label: 'Location', value: item.locationLabel },
    { icon: CalendarDays, label: isFound ? 'Date found' : 'Date lost', value: formatDate(item.dateOccurred) },
    { icon: RefreshCw, label: closed ? 'Status' : 'Listed until', value: closed ? (item.status === 'resolved' ? 'Returned' : 'Expired') : item.expiresAt ? formatDate(item.expiresAt) : 'Open' },
  ];

  const showForm = !item.isOwner && !closed && item.myClaimStatus !== 'approved' && !requestPending && item.myClaimStatus !== 'rejected';

  return (
    <div className="container-page pb-24">
      {dialog}
      <nav aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm text-muted">
        <Link to="/dashboard" className="inline-flex shrink-0 items-center gap-1.5 rounded-full font-medium hover:text-ink">
          <ArrowLeft size={16} aria-hidden /> Campus board
        </Link>
        <span aria-hidden>/</span>
        <span className="truncate text-ink">{item.title}</span>
      </nav>

      <div className="mt-6 grid gap-10 lg:grid-cols-12 lg:gap-14">
        <div className="lg:col-span-7">
          <div className="lg:sticky lg:top-28">
            <div className="relative aspect-[4/3] overflow-hidden rounded-panel border border-line bg-paper">
              <m.div
                key={active}
                initial={{ opacity: 0.4, scale: 1.02 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, ease: EASE_OUT }}
                className="h-full w-full"
              >
                <ItemImage item={item} index={active} eager size="lg" className="h-full w-full" />
              </m.div>
              <div className="pointer-events-none absolute left-4 top-4 flex gap-1.5">
                <TypeLabel type={item.type} />
                <ItemStatusBadge status={item.status} />
              </div>
              {item.images.length > 1 && (
                <span className="chip absolute bottom-4 right-4 bg-night/75 text-white backdrop-blur">
                  {active + 1} / {item.images.length}
                </span>
              )}
            </div>
            {item.images.length > 1 && (
              <ul className="mt-3 flex flex-wrap gap-2">
                {item.images.map((img, i) => (
                  <li key={img.url}>
                    <button
                      type="button"
                      onClick={() => setActive(i)}
                      aria-label={`Show photo ${i + 1}`}
                      aria-current={i === active}
                      className={`h-20 w-20 overflow-hidden rounded-xl border-2 transition ${i === active ? 'border-ink' : 'border-transparent opacity-70 hover:opacity-100'}`}
                    >
                      <img src={img.thumbUrl ?? img.url} alt="" className="h-full w-full object-cover" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        <div className="lg:col-span-5">
          <p className="eyebrow text-muted">
            {isFound ? 'Found item' : 'Lost item'} · {category}
          </p>
          <h1 className="mt-3 text-display-lg font-bold">{item.title}</h1>

          <dl className="mt-8 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line">
            {facts.map((f) => (
              <div key={f.label} className="bg-surface p-4">
                <dt className="eyebrow flex items-center gap-1.5 text-muted">
                  <f.icon size={13} aria-hidden /> {f.label}
                </dt>
                <dd className="mt-1.5 text-[15px] font-medium">{f.value}</dd>
              </div>
            ))}
          </dl>

          <p className="mt-6 whitespace-pre-line text-[15.5px] leading-relaxed text-ink-soft">{item.description}</p>

          <div className="mt-6 flex items-center gap-3 rounded-2xl border border-line bg-surface p-3">
            <Avatar name={item.owner.name} src={item.owner.avatarUrl} />
            <div className="min-w-0 flex-1">
              <p className="eyebrow text-muted">Posted by</p>
              {item.owner.id ? (
                <Link to={`/u/${item.owner.id}`} className="block truncate font-semibold hover:underline">{item.isOwner ? 'You' : item.owner.name}</Link>
              ) : (
                <p className="truncate font-semibold">{item.owner.name}</p>
              )}
              <p className="text-xs text-muted">{timeAgo(item.createdAt)}</p>
            </div>
            {!item.isOwner && item.status !== 'removed' && (
              <button type="button" disabled={chatBusy} onClick={openChat} className="btn-primary btn-sm">
                <MessageCircle size={15} aria-hidden /> {chatBusy ? 'Opening…' : 'Message'}
              </button>
            )}
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            <button type="button" onClick={toggleSave} aria-pressed={isSaved} className={isSaved ? 'btn-ink' : 'btn-secondary'}>
              <Bookmark size={16} className={isSaved ? 'fill-lime text-lime' : ''} aria-hidden /> {isSaved ? 'Saved' : 'Save'}
            </button>
            <button type="button" onClick={copyLink} className="btn-secondary">
              {copied ? <Check size={16} aria-hidden className="text-lime-ink" /> : <Link2 size={16} aria-hidden />}
              {copied ? 'Link copied' : 'Copy link'}
            </button>
            {!item.isOwner && (
              <button type="button" onClick={() => setReporting(true)} className="btn-ghost text-muted hover:text-danger">
                <Flag size={15} aria-hidden /> Report
              </button>
            )}
          </div>
          {actionError && <p role="alert" className="mt-3 text-sm text-danger">{actionError}</p>}

          <section
            aria-labelledby="action-heading"
            className={`mt-8 rounded-panel p-6 sm:p-7 ${showForm ? 'on-dark bg-night text-white shadow-pop' : 'border border-line bg-surface'}`}
          >
            {item.isOwner ? (
              <StatePanel icon={UserCheck} tone="bg-cobalt-soft text-cobalt-ink" title="This is your listing">
                <p className="mt-1.5 text-sm text-muted">Requests and messages from other members appear in your profile and inbox. Once the item has been handed over, mark the listing as returned.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/profile?tab=requests" className="btn-secondary">View requests</Link>
                  <Link to="/messages" className="btn-secondary"><MessageCircle size={15} aria-hidden /> Messages</Link>
                  {!closed && <button type="button" onClick={renew} className="btn-secondary"><RefreshCw size={15} aria-hidden /> Renew for 90 days</button>}
                  {!closed && <button type="button" onClick={markResolved} className="btn-primary">Mark as returned</button>}
                </div>
              </StatePanel>
            ) : closed ? (
              <StatePanel icon={CircleSlash} tone="bg-paper-deep text-ink-soft" title="This listing is closed">
                <p className="mt-1.5 text-sm text-muted">It has been {item.status === 'resolved' ? 'resolved' : 'taken down because it expired'}, so it no longer accepts requests.</p>
              </StatePanel>
            ) : item.myClaimStatus === 'approved' ? (
              <StatePanel icon={BadgeCheck} tone="bg-lime text-ink" title="Your request was approved">
                <p className="mt-1.5 text-sm text-muted">Contact details are now available under your requests.</p>
                <Link to="/profile?tab=requests" className="btn-primary mt-5">View contact details</Link>
              </StatePanel>
            ) : requestPending ? (
              <StatePanel icon={Hourglass} tone="bg-amber-100 text-amber-700" title="Request sent">
                <p className="mt-1.5 text-sm text-muted">The owner of this listing will review it. Your contact details are shared only if they approve.</p>
              </StatePanel>
            ) : item.myClaimStatus === 'rejected' ? (
              <StatePanel icon={XCircle} tone="bg-danger-soft text-danger" title="Your last request was declined">
                <p className="mt-1.5 text-sm text-muted">If you believe this was a mistake, send the owner a message to clarify, or report the listing.</p>
              </StatePanel>
            ) : (
              <form onSubmit={submit} noValidate>
                <p className="eyebrow text-white/50">{isFound ? 'Claim this item' : 'Help return it'}</p>
                <h2 id="action-heading" className="mt-2 text-display-md font-bold">{isFound ? 'Is this yours?' : 'Have you found this?'}</h2>
                <label htmlFor="claim-message" className="mt-5 block text-sm font-semibold text-white">
                  {isFound ? item.verificationQuestion ?? 'Describe the item so the finder can confirm it is yours' : 'Where did you find it, and how can you hand it over?'}
                </label>
                <textarea
                  id="claim-message"
                  rows={4}
                  maxLength={1000}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  aria-invalid={Boolean(formError)}
                  aria-describedby={formError ? 'claim-error' : 'claim-hint'}
                  className="field mt-2 border-white/15 bg-white/[0.06] text-white placeholder:text-white/35 hover:border-white/25 focus:border-lime focus:ring-lime/20"
                  placeholder={isFound ? 'Your answer, plus any detail only the owner would know' : 'e.g. Found it near the library steps, can meet at the main gate'}
                />
                <div className="mt-2 flex items-start justify-between gap-3 text-xs">
                  {formError ? (
                    <p id="claim-error" role="alert" className="font-medium text-coral">{formError}</p>
                  ) : (
                    <p id="claim-hint" className="text-white/45">At least 10 characters.</p>
                  )}
                  <span className="shrink-0 font-mono text-white/40" aria-hidden>{message.length}/1000</span>
                </div>
                <button type="submit" disabled={busy} className="btn-lime btn-lg mt-5 w-full sm:w-auto">
                  {busy ? 'Sending…' : isFound ? 'Send claim' : 'Offer to return it'}
                </button>
                <p className="mt-4 flex gap-2 text-xs text-white/55">
                  <ShieldCheck size={14} className="mt-0.5 shrink-0 text-lime" aria-hidden />
                  Your email and phone stay private until the owner approves your request.
                </p>
              </form>
            )}
          </section>

          <aside className="mt-4 flex gap-3 rounded-2xl bg-lime-soft p-4 text-sm text-lime-ink">
            <ShieldCheck size={18} className="mt-0.5 shrink-0" aria-hidden />
            <div>
              <p className="font-semibold">Safety reminder</p>
              <p className="mt-0.5">Hand items over in a public place on campus. Never share OTPs, passwords or payment details.</p>
            </div>
          </aside>
        </div>
      </div>

      {matchItems.length > 0 && (
        <section aria-labelledby="matches-heading" className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <p className="eyebrow flex items-center gap-2 text-muted"><Sparkles size={13} aria-hidden /> Suggested by category and keywords</p>
              <h2 id="matches-heading" className="mt-2 text-display-md font-bold">
                {item.isOwner ? 'Possible matches for your report' : isFound ? 'Lost reports that may match' : 'Found items that may match'}
              </h2>
            </div>
            <Link to={`/dashboard?type=${isFound ? 'lost' : 'found'}&category=${item.category}`} className="btn-secondary btn-sm">View all in {category}</Link>
          </div>
          <RevealGroup className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {matchItems.slice(0, 3).map((match) => (
              <RevealItem key={match.id}>
                <ItemCard item={match} signedIn onToggleSave={toggleMatchSave} />
              </RevealItem>
            ))}
          </RevealGroup>
        </section>
      )}

      {reporting && <ReportDialog itemId={item.id} onClose={() => setReporting(false)} />}
    </div>
  );
}
