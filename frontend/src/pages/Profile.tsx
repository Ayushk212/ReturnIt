import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { AnimatePresence, m } from 'motion/react';
import {
  AlertCircle,
  Bookmark,
  CalendarDays,
  Camera,
  CircleCheck,
  ExternalLink,
  Inbox,
  LayoutList,
  LogOut,
  MailCheck,
  MapPin,
  MessageCircle,
  PackageCheck,
  Plus,
  RefreshCw,
  Search,
  Send,
  Settings,
  Trash2,
  type LucideIcon,
} from 'lucide-react';
import Avatar from '../components/Avatar';
import { useConfirm } from '../components/ConfirmDialog';
import ItemCard from '../components/ItemCard';
import ItemImage from '../components/ItemImage';
import PageBanner from '../components/PageBanner';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { ClaimStatusBadge, ItemStatusBadge } from '../components/StatusBadge';
import { useAuth } from '../context/AuthContext';
import { useChat } from '../context/ChatContext';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { formatDate, timeAgo } from '../lib/format';
import { compressImage } from '../lib/imageCompression';
import { EASE_OUT, spring } from '../lib/motion';
import { ACADEMIC_YEARS, BRANCHES, PROGRAMMES, SECTION_PATTERN } from '../lib/profile';
import type { Claim, Item, MyProfile } from '../lib/types';

const TABS = [
  { key: 'overview', label: 'Overview', icon: LayoutList },
  { key: 'saved', label: 'Saved', icon: Bookmark },
  { key: 'requests', label: 'Requests', icon: Inbox },
  { key: 'settings', label: 'Edit profile', icon: Settings },
] as const satisfies readonly { key: string; label: string; icon: LucideIcon }[];
type TabKey = (typeof TABS)[number]['key'];

// Older links (`?tab=posts`, `?tab=claims`, `?tab=account`) still land on the right section.
const ALIASES: Record<string, TabKey> = { posts: 'overview', reports: 'overview', claims: 'requests', account: 'settings' };

function RowSkeleton() {
  return (
    <div className="card flex items-center gap-4 p-3" aria-hidden>
      <div className="skeleton h-16 w-16 rounded-xl" />
      <div className="flex-1 space-y-2.5">
        <div className="skeleton h-3 w-1/4" />
        <div className="skeleton h-5 w-1/2" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Overview: bio, then lost and found history                          */
/* ------------------------------------------------------------------ */

function HistoryList({ title, icon: Icon, tone, items, emptyText, postType, busyId, onResolve, onRenew }: {
  title: string;
  icon: LucideIcon;
  tone: string;
  items: Item[];
  emptyText: string;
  postType: 'lost' | 'found';
  busyId: string | null;
  onResolve: (id: string) => void;
  onRenew: (id: string) => void;
}) {
  return (
    <section aria-labelledby={`history-${postType}`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id={`history-${postType}`} className="flex items-center gap-2.5 text-xl font-semibold tracking-tight">
          <span className={`grid h-9 w-9 place-items-center rounded-xl ${tone}`} aria-hidden><Icon size={17} /></span>
          {title}
          <span className="font-mono text-xs font-normal text-muted">{items.length}</span>
        </h2>
        <Link to={`/post?type=${postType}`} className="btn-ghost btn-sm">
          <Plus size={14} aria-hidden /> New
        </Link>
      </div>
      {items.length === 0 ? (
        <p className="mt-4 rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted">{emptyText}</p>
      ) : (
        <ul className="mt-4 space-y-2.5">
          {items.map((item) => {
            const active = item.status === 'open' || item.status === 'claim_pending';
            const expiresSoon = active && item.expiresAt && new Date(item.expiresAt).getTime() - Date.now() < 14 * 86_400_000;
            return (
              <li key={item.id} className="card flex flex-wrap items-center gap-3 p-3 transition-colors hover:border-line-strong">
                <div className="h-16 w-16 shrink-0 overflow-hidden rounded-xl bg-paper">
                  <ItemImage item={item} size="xs" thumb className="h-full w-full" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <ItemStatusBadge status={item.status} />
                    <span className="eyebrow text-muted">{timeAgo(item.createdAt)}</span>
                  </div>
                  <Link to={`/items/${item.id}`} className="mt-1.5 block truncate font-semibold tracking-tight hover:underline">{item.title}</Link>
                  <p className="flex items-center gap-1.5 truncate text-xs text-muted">
                    <MapPin size={12} aria-hidden className="shrink-0" /> {item.locationLabel}
                  </p>
                  {expiresSoon && <p className="mt-1 text-xs font-medium text-amber-700">Expires {formatDate(item.expiresAt!)}</p>}
                </div>
                {active && (
                  <div className="flex w-full gap-2 sm:w-auto">
                    {expiresSoon && (
                      <button type="button" disabled={busyId === item.id} onClick={() => onRenew(item.id)} className="btn-secondary btn-sm flex-1 sm:flex-none">
                        <RefreshCw size={13} aria-hidden /> Renew
                      </button>
                    )}
                    <button type="button" disabled={busyId === item.id} onClick={() => onResolve(item.id)} className="btn-ink btn-sm flex-1 sm:flex-none">
                      {busyId === item.id ? 'Saving…' : 'Mark returned'}
                    </button>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function Overview({ profile }: { profile: MyProfile }) {
  const { data, loading, error, reload } = useAsync(() => api.listMine(), []);
  const { refreshProfile } = useAuth();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const { confirm, dialog } = useConfirm();

  async function act(id: string, fn: () => Promise<unknown>) {
    setBusyId(id);
    setActionError(null);
    try {
      await fn();
      reload();
      void refreshProfile();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the listing.');
    } finally {
      setBusyId(null);
    }
  }

  async function resolve(id: string) {
    const ok = await confirm({ title: 'Mark this listing as returned?', body: 'It will close and stop accepting new requests.', confirmLabel: 'Mark as returned' });
    if (ok) await act(id, () => api.resolveItem(id));
  }

  const items = data ?? [];
  const lost = items.filter((i) => i.type === 'lost');
  const found = items.filter((i) => i.type === 'found');

  return (
    <div className="space-y-10">
      {dialog}
      <section aria-labelledby="about-heading" className="card p-6">
        <div className="flex items-center justify-between gap-3">
          <h2 id="about-heading" className="text-xl font-semibold tracking-tight">About</h2>
          <Link to="/profile?tab=settings" className="btn-ghost btn-sm">Edit</Link>
        </div>
        <p className={`mt-3 max-w-3xl leading-relaxed ${profile.bio ? 'text-ink-soft' : 'text-muted'}`}>
          {profile.bio || 'Add a short bio so members know who they are speaking with.'}
        </p>
        {profile.academic.summary && (
          <dl className="mt-5 grid grid-cols-2 gap-px overflow-hidden rounded-2xl border border-line bg-line sm:grid-cols-4">
            {[
              ['Programme', profile.academic.programme],
              ['Year', profile.academic.academicYear && profile.academic.academicYear !== 'Not applicable' ? profile.academic.academicYear : '—'],
              ['Branch', profile.academic.branch],
              ['Section', profile.academic.section || '—'],
            ].map(([label, value]) => (
              <div key={label} className="bg-surface p-4">
                <dt className="eyebrow text-muted">{label}</dt>
                <dd className="mt-1.5 text-sm font-medium">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>

      {actionError && <p role="alert" className="text-sm font-medium text-danger">{actionError}</p>}
      {loading && !data ? (
        <div className="grid gap-8 lg:grid-cols-2">
          {[0, 1].map((k) => <div key={k} className="space-y-3">{Array.from({ length: 2 }, (_, i) => <RowSkeleton key={i} />)}</div>)}
        </div>
      ) : error ? (
        <ErrorState message={error} onRetry={reload} />
      ) : (
        <div className="grid gap-10 lg:grid-cols-2 lg:gap-8">
          <HistoryList
            title="Lost reports"
            icon={Search}
            tone="bg-coral-soft text-coral-ink"
            items={lost}
            postType="lost"
            emptyText="You have not reported anything as lost."
            busyId={busyId}
            onResolve={resolve}
            onRenew={(id) => act(id, () => api.renewItem(id))}
          />
          <HistoryList
            title="Found reports"
            icon={PackageCheck}
            tone="bg-lime-soft text-lime-ink"
            items={found}
            postType="found"
            emptyText="You have not reported anything as found."
            busyId={busyId}
            onResolve={resolve}
            onRenew={(id) => act(id, () => api.renewItem(id))}
          />
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Saved                                                              */
/* ------------------------------------------------------------------ */

function SavedItems() {
  const { user } = useAuth();
  const { data, loading, error, reload } = useAsync(() => api.listSaved(), []);
  const [removed, setRemoved] = useState<string[]>([]);

  async function toggle(item: Item) {
    setRemoved((r) => [...r, item.id]);
    try {
      await api.toggleSave(item.id);
    } catch {
      setRemoved((r) => r.filter((id) => id !== item.id));
    }
  }

  if (loading && !data) return <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const items = (data ?? []).filter((i) => !removed.includes(i.id));
  if (items.length === 0) {
    return (
      <EmptyState title="No saved items" icon={<Bookmark size={24} strokeWidth={1.8} />}>
        <p>Use the bookmark on any listing to keep track of it here.</p>
        <Link to="/dashboard" className="btn-secondary mt-5">Browse listings</Link>
      </EmptyState>
    );
  }
  return (
    <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
      <AnimatePresence initial={false}>
        {items.map((item) => (
          <m.div key={item.id} layout exit={{ opacity: 0, scale: 0.96 }} transition={{ duration: 0.25, ease: EASE_OUT }}>
            <ItemCard item={item} signedIn={Boolean(user)} onToggleSave={toggle} />
          </m.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Requests                                                           */
/* ------------------------------------------------------------------ */

function ClaimRow({ claim, busy, onDecide, onMessage }: { claim: Claim; busy: boolean; onDecide: (id: string, d: 'approve' | 'reject' | 'withdraw') => void; onMessage: (claim: Claim) => void }) {
  const received = claim.direction === 'received';
  return (
    <li className="card p-5 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 gap-3">
          {received ? <Avatar name={claim.counterpartName} size="md" /> : (
            <span aria-hidden className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-paper-deep text-ink-soft"><Send size={16} /></span>
          )}
          <div className="min-w-0">
            <p className="text-sm text-muted">
              {received ? `${claim.counterpartName} sent a request on` : `Your request to ${claim.counterpartName} on`} <span className="eyebrow ml-1">· {timeAgo(claim.createdAt)}</span>
            </p>
            <Link to={`/items/${claim.itemId}`} className="block truncate font-display text-lg font-semibold tracking-tight hover:underline">{claim.itemTitle}</Link>
          </div>
        </div>
        <ClaimStatusBadge status={claim.status} />
      </div>
      <p className="mt-4 rounded-2xl rounded-tl-md bg-paper p-4 text-sm leading-relaxed">{claim.message}</p>
      {claim.contact && (
        <p className="mt-3 flex flex-wrap items-center gap-2 rounded-2xl bg-lime-soft p-4 text-sm text-lime-ink">
          <MailCheck size={17} aria-hidden className="shrink-0" />
          <span>
            Contact {claim.contact.name}:{' '}
            <a href={`mailto:${claim.contact.email}`} className="font-semibold text-ink underline decoration-lime-ink/40 underline-offset-4 hover:decoration-ink">{claim.contact.email}</a>
          </span>
        </p>
      )}
      <div className="mt-4 flex flex-wrap gap-2">
        {claim.status === 'pending' && received && (
          <>
            <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'approve')} className="btn-primary btn-sm">Approve</button>
            <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'reject')} className="btn-secondary btn-sm">Decline</button>
          </>
        )}
        {claim.status === 'pending' && !received && (
          <button type="button" disabled={busy} onClick={() => onDecide(claim.id, 'withdraw')} className="btn-secondary btn-sm">Withdraw request</button>
        )}
        {claim.counterpartId && (
          <button type="button" disabled={busy} onClick={() => onMessage(claim)} className="btn-ghost btn-sm">
            <MessageCircle size={14} aria-hidden /> Message {claim.counterpartName.split(' ')[0]}
          </button>
        )}
      </div>
    </li>
  );
}

function Requests() {
  const { data, loading, error, reload } = useAsync(() => api.listClaims(), []);
  const { refreshSummary } = useChat();
  const navigate = useNavigate();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  async function decide(id: string, decision: 'approve' | 'reject' | 'withdraw') {
    setBusyId(id);
    setActionError(null);
    try {
      await api.decideClaim(id, decision);
      reload();
      void refreshSummary();
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not update the request.');
    } finally {
      setBusyId(null);
    }
  }

  async function message(claim: Claim) {
    setBusyId(claim.id);
    setActionError(null);
    try {
      const convo = await api.startConversation(claim.itemId, claim.direction === 'received' ? claim.counterpartId : undefined);
      navigate(`/messages/${convo.id}`);
    } catch (e) {
      setActionError(e instanceof Error ? e.message : 'Could not open the conversation.');
      setBusyId(null);
    }
  }

  if (loading && !data) return <div className="space-y-3">{Array.from({ length: 2 }, (_, i) => <RowSkeleton key={i} />)}</div>;
  if (error) return <ErrorState message={error} onRetry={reload} />;
  const claims = data ?? [];
  const received = claims.filter((c) => c.direction === 'received');
  const sent = claims.filter((c) => c.direction === 'sent');

  const section = (id: string, title: string, list: Claim[], empty: string) => (
    <section aria-labelledby={id}>
      <h2 id={id} className="flex items-baseline gap-3 text-xl font-semibold tracking-tight">
        {title} <span className="font-mono text-xs font-normal text-muted">{list.length}</span>
      </h2>
      {list.length === 0 ? (
        <p className="mt-3 rounded-2xl border border-dashed border-line-strong p-5 text-sm text-muted">{empty}</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {list.map((c) => <ClaimRow key={c.id} claim={c} busy={busyId === c.id} onDecide={decide} onMessage={message} />)}
        </ul>
      )}
    </section>
  );

  return (
    <div className="space-y-12">
      {actionError && <p role="alert" className="text-sm font-medium text-danger">{actionError}</p>}
      {section('received-heading', 'Requests on your listings', received, 'No one has sent a request on your listings yet.')}
      {section('sent-heading', 'Requests you sent', sent, 'You have not sent any requests. Open a listing to claim an item or offer to return one.')}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Settings                                                           */
/* ------------------------------------------------------------------ */

function SettingsPanel({ profile }: { profile: MyProfile }) {
  const { setProfile, signOut } = useAuth();
  const navigate = useNavigate();
  const fileInput = useRef<HTMLInputElement>(null);
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: profile.name,
    programme: profile.academic.programme ?? 'B.Tech',
    academicYear: profile.academic.academicYear ?? '',
    branch: profile.academic.branch ?? '',
    section: profile.academic.section ?? '',
    bio: profile.bio,
  });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isStaff = form.programme === 'Faculty' || form.programme === 'Staff';

  async function onPhoto(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setPhotoError('Use a JPG, PNG or WebP image.');
      return;
    }
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      const { file: small } = await compressImage(file, { maxEdge: 800, quality: 0.85, skipBelowBytes: 200 * 1024 });
      setProfile(await api.uploadAvatar(small));
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not upload the photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function removePhoto() {
    setPhotoBusy(true);
    setPhotoError(null);
    try {
      setProfile(await api.removeAvatar());
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : 'Could not remove the photo.');
    } finally {
      setPhotoBusy(false);
    }
  }

  async function save(e: FormEvent) {
    e.preventDefault();
    if (form.name.trim().length < 2) return setError('Enter your full name.');
    if (form.section && !SECTION_PATTERN.test(form.section.trim())) return setError('Section can use up to 6 letters or digits.');
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      setProfile(
        await api.updateProfile({
          name: form.name.trim(),
          programme: form.programme,
          academicYear: isStaff ? 'Not applicable' : form.academicYear || undefined,
          branch: form.branch || undefined,
          section: isStaff ? '' : form.section.trim(),
          bio: form.bio.trim(),
        }),
      );
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save your changes.');
    } finally {
      setSaving(false);
    }
  }

  const set = (k: keyof typeof form) => (e: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setSaved(false);
    setForm((f) => ({ ...f, [k]: e.target.value }));
  };

  return (
    <div className="grid gap-6 lg:grid-cols-12">
      <section aria-labelledby="photo-heading" className="card p-6 lg:col-span-4">
        <h2 id="photo-heading" className="text-xl font-semibold tracking-tight">Profile photo</h2>
        <p className="mt-1 text-sm text-muted">Photos are resized and compressed automatically. JPG, PNG or WebP.</p>
        <div className="mt-6 flex flex-col items-center gap-4">
          <Avatar name={profile.name} src={profile.avatarUrl} size="xl" className="ring-4 ring-paper" />
          <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="sr-only" id="avatar-input" onChange={onPhoto} />
          <div className="flex flex-wrap justify-center gap-2">
            <button type="button" disabled={photoBusy} onClick={() => fileInput.current?.click()} className="btn-primary btn-sm">
              <Camera size={14} aria-hidden /> {photoBusy ? 'Uploading…' : profile.hasUploadedAvatar ? 'Change photo' : 'Upload photo'}
            </button>
            {(profile.hasUploadedAvatar || profile.avatarUrl) && (
              <button type="button" disabled={photoBusy} onClick={removePhoto} className="btn-secondary btn-sm">
                <Trash2 size={14} aria-hidden /> Remove
              </button>
            )}
          </div>
          {photoError && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger"><AlertCircle size={14} aria-hidden /> {photoError}</p>}
        </div>
      </section>

      <form onSubmit={save} noValidate aria-labelledby="details-heading" className="card space-y-5 p-6 lg:col-span-8">
        <h2 id="details-heading" className="text-xl font-semibold tracking-tight">Personal and academic details</h2>
        <div>
          <label htmlFor="s-name" className="label">Full name</label>
          <input id="s-name" className="field" maxLength={80} value={form.name} onChange={set('name')} />
        </div>
        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label htmlFor="s-programme" className="label">Programme or role</label>
            <select id="s-programme" className="field" value={form.programme} onChange={set('programme')}>
              {PROGRAMMES.map((p) => <option key={p}>{p}</option>)}
            </select>
          </div>
          {!isStaff && (
            <div>
              <label htmlFor="s-year" className="label">Year</label>
              <select id="s-year" className="field" value={form.academicYear} onChange={set('academicYear')}>
                <option value="">Select your year</option>
                {ACADEMIC_YEARS.filter((y) => y !== 'Not applicable').map((y) => <option key={y}>{y}</option>)}
              </select>
            </div>
          )}
        </div>
        <div className="grid gap-5 sm:grid-cols-[1fr_9rem]">
          <div>
            <label htmlFor="s-branch" className="label">{isStaff ? 'Department' : 'Branch'}</label>
            <select id="s-branch" className="field" value={form.branch} onChange={set('branch')}>
              <option value="">Select</option>
              {BRANCHES.map((b) => <option key={b}>{b}</option>)}
            </select>
          </div>
          {!isStaff && (
            <div>
              <label htmlFor="s-section" className="label">Section <span className="optional">Optional</span></label>
              <input id="s-section" className="field uppercase" maxLength={6} value={form.section} onChange={set('section')} />
            </div>
          )}
        </div>
        <div>
          <div className="flex items-center justify-between">
            <label htmlFor="s-bio" className="label">Bio</label>
            <span className="font-mono text-[11px] text-muted" aria-hidden>{form.bio.length}/500</span>
          </div>
          <textarea id="s-bio" rows={4} maxLength={500} className="field" value={form.bio} onChange={set('bio')} />
          <p className="hint">Visible to signed-in members on your public profile. Do not include phone or room numbers.</p>
        </div>
        {error && <p role="alert" className="flex items-center gap-1.5 text-sm font-medium text-danger"><AlertCircle size={14} aria-hidden /> {error}</p>}
        {saved && <p role="status" className="flex items-center gap-1.5 text-sm font-medium text-lime-ink"><CircleCheck size={14} aria-hidden /> Your profile has been updated.</p>}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line pt-5">
          <button type="submit" disabled={saving} className="btn-primary">{saving ? 'Saving…' : 'Save changes'}</button>
          <button type="button" onClick={async () => { await signOut(); navigate('/'); }} className="btn-ghost text-danger hover:bg-danger-soft">
            <LogOut size={16} aria-hidden /> Sign out
          </button>
        </div>
      </form>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Page                                                               */
/* ------------------------------------------------------------------ */

export default function Profile() {
  const { user, profile } = useAuth();
  const { summary } = useChat();
  const [params] = useSearchParams();
  const raw = params.get('tab') ?? 'overview';
  const tab: TabKey = (TABS.some((t) => t.key === raw) ? raw : ALIASES[raw] ?? 'overview') as TabKey;

  useEffect(() => {
    document.title = 'My profile | ReturnIt';
  }, []);

  if (!user) return null;
  if (!profile) {
    return (
      <div className="container-page pt-32">
        <div className="skeleton h-40 rounded-panel" />
      </div>
    );
  }

  const stats = profile.stats ?? { lost: 0, found: 0, resolved: 0, active: 0 };
  const card = (
    <div className="rounded-panel border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md">
      <div className="flex items-center gap-4">
        <Avatar name={profile.name} src={profile.avatarUrl} size="lg" className="ring-2 ring-white/20" />
        <div className="min-w-0">
          <p className="truncate font-mono text-xs text-white/60">{profile.email}</p>
          <p className="mt-1 flex items-center gap-1.5 text-xs text-white/50">
            <CalendarDays size={12} aria-hidden /> Member since {formatDate(profile.createdAt)}
          </p>
        </div>
      </div>
      <dl className="mt-5 grid grid-cols-4 gap-2 text-center">
        {[
          ['Lost', stats.lost],
          ['Found', stats.found],
          ['Returned', stats.resolved],
          ['Active', stats.active],
        ].map(([label, value]) => (
          <div key={label} className="flex flex-col-reverse rounded-2xl bg-white/[0.06] px-2 py-3">
            <dt className="eyebrow mt-0.5 text-[10px] text-white/50">{label}</dt>
            <dd className="font-display text-2xl font-bold">{value}</dd>
          </div>
        ))}
      </dl>
    </div>
  );

  return (
    <div className="pb-24">
      <PageBanner
        eyebrow="My profile"
        title={profile.name}
        description={profile.academic.summary || 'Add your programme, year and branch so members can recognise you.'}
        actions={
          <>
            <Link to="/post" className="btn-lime"><Plus size={16} aria-hidden /> Post an item</Link>
            <Link to={`/u/${profile.id}`} className="btn-glass"><ExternalLink size={15} aria-hidden /> View public profile</Link>
          </>
        }
        aside={card}
      />

      <div className="container-page">
        <nav aria-label="Profile sections" className="scrollbar-none relative z-10 -mt-6 overflow-x-auto pb-1">
          <div className="inline-flex gap-1 rounded-full border border-line bg-surface p-1 shadow-lift">
            {TABS.map((t) => (
              <Link
                key={t.key}
                to={`/profile?tab=${t.key}`}
                aria-current={tab === t.key ? 'page' : undefined}
                className={`relative flex shrink-0 items-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition-colors ${tab === t.key ? 'text-white' : 'text-muted hover:text-ink'}`}
              >
                {tab === t.key && <m.span layoutId="profile-tab" transition={spring} className="absolute inset-0 rounded-full bg-ink" aria-hidden />}
                <t.icon size={15} aria-hidden className="relative" />
                <span className="relative">{t.label}</span>
                {t.key === 'requests' && summary.pendingRequests > 0 && (
                  <span className="relative grid h-[18px] min-w-[18px] place-items-center rounded-full bg-coral px-1 font-mono text-[10px] text-ink">{summary.pendingRequests}</span>
                )}
              </Link>
            ))}
          </div>
        </nav>

        <m.div key={tab} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.3, ease: EASE_OUT }} className="mt-8">
          {tab === 'overview' && <Overview profile={profile} />}
          {tab === 'saved' && <SavedItems />}
          {tab === 'requests' && <Requests />}
          {tab === 'settings' && <SettingsPanel key={profile.id} profile={profile} />}
        </m.div>
      </div>
    </div>
  );
}
