import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { ArrowLeft, CalendarDays, GraduationCap, LayoutList, ShieldCheck } from 'lucide-react';
import Avatar from '../components/Avatar';
import ItemCard from '../components/ItemCard';
import { RevealGroup, RevealItem } from '../components/Motion';
import PageBanner from '../components/PageBanner';
import { CardSkeleton, EmptyState, ErrorState } from '../components/States';
import { useAuth } from '../context/AuthContext';
import { useAsync } from '../hooks/useAsync';
import { useSaveToggle } from '../hooks/useSaveToggle';
import { api } from '../lib/api';
import { formatDate } from '../lib/format';

export default function PublicProfile() {
  const { id = '' } = useParams();
  const { user } = useAuth();
  const person = useAsync(() => api.getPublicProfile(id), [id]);
  const listings = useAsync(() => api.listUserListings(id), [id]);
  const { items, toggleSave } = useSaveToggle(listings.data);

  useEffect(() => {
    if (person.data) document.title = `${person.data.name} | ReturnIt`;
  }, [person.data]);

  if (person.error) {
    return (
      <div className="container-page pb-24 pt-32">
        <ErrorState title="This profile is unavailable." message={person.error} onRetry={person.reload} />
        <p className="mt-6 text-center text-sm">
          <Link to="/dashboard" className="inline-flex items-center gap-1.5 font-semibold text-cobalt hover:underline"><ArrowLeft size={16} aria-hidden /> Back to the board</Link>
        </p>
      </div>
    );
  }

  const p = person.data;
  const isMe = user?.uid === id;

  return (
    <div className="pb-24">
      <PageBanner
        eyebrow={<><ShieldCheck size={14} aria-hidden /> Verified campus member</>}
        title={p ? p.name : <span className="skeleton inline-block h-12 w-64 align-middle" />}
        description={p?.academic.summary || (p ? 'Academic details not provided.' : '')}
        actions={isMe ? <Link to="/profile?tab=settings" className="btn-glass">Edit your profile</Link> : undefined}
        aside={
          p ? (
            <div className="rounded-panel border border-white/10 bg-white/[0.06] p-5 backdrop-blur-md">
              <div className="flex items-center gap-4">
                <Avatar name={p.name} src={p.avatarUrl} size="xl" className="ring-2 ring-white/20" />
                <dl className="space-y-2 text-sm text-white/70">
                  <div className="flex items-center gap-2"><dt className="sr-only">Member since</dt><dd className="flex items-center gap-2"><CalendarDays size={14} aria-hidden />Member since {formatDate(p.createdAt)}</dd></div>
                  <div className="flex items-center gap-2"><dt className="sr-only">Listings</dt><dd className="flex items-center gap-2"><LayoutList size={14} aria-hidden />{p.stats.lost + p.stats.found} reports · {p.stats.resolved} returned</dd></div>
                  {p.academic.branch && <div className="flex items-center gap-2"><dt className="sr-only">Branch</dt><dd className="flex items-center gap-2"><GraduationCap size={14} aria-hidden />{p.academic.branch}</dd></div>}
                </dl>
              </div>
            </div>
          ) : undefined
        }
      />

      <div className="container-page mt-10 space-y-12">
        {p?.bio && (
          <section aria-labelledby="bio-heading" className="card max-w-3xl p-6">
            <h2 id="bio-heading" className="text-xl font-semibold tracking-tight">About</h2>
            <p className="mt-3 leading-relaxed text-ink-soft">{p.bio}</p>
          </section>
        )}

        <section aria-labelledby="listings-heading">
          <h2 id="listings-heading" className="text-display-md font-bold">Active listings</h2>
          <p className="mt-2 text-sm text-muted">Open a listing to send a request or message {p ? p.name.split(' ')[0] : 'this member'} about it.</p>
          <div className="mt-6">
            {listings.loading && !listings.data ? (
              <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">{Array.from({ length: 3 }, (_, i) => <CardSkeleton key={i} />)}</div>
            ) : listings.error ? (
              <ErrorState message={listings.error} onRetry={listings.reload} />
            ) : items.length === 0 ? (
              <EmptyState title="No active listings">
                <p>This member has no open lost or found reports at the moment.</p>
              </EmptyState>
            ) : (
              <RevealGroup className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
                {items.map((item) => (
                  <RevealItem key={item.id}>
                    <ItemCard item={item} signedIn={Boolean(user)} onToggleSave={toggleSave} />
                  </RevealItem>
                ))}
              </RevealGroup>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
