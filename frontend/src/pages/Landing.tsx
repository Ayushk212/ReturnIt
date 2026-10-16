import { Link } from 'react-router-dom';
import { ArrowRight, Check } from 'lucide-react';
import TypeLabel from '../components/TypeLabel';
import { useAsync } from '../hooks/useAsync';
import { api } from '../lib/api';
import { timeAgo } from '../lib/format';

const STEPS = [
  { n: '01', title: 'Post it', body: 'Report what you lost or found with the place, the date and a photo if you have one. It takes about a minute.' },
  { n: '02', title: 'Send a request', body: 'Listings are visible to everyone, and opening one needs a campus sign-in. Owners and finders connect through a request, not a public comment thread.' },
  { n: '03', title: 'Verify and hand over', body: 'Finders set a private question that only the real owner can answer. Once a request is approved, you share contact details and meet in a public spot.' },
];

const ASSURANCES = [
  'Sign-in is limited to @mnnit.ac.in accounts.',
  'Email and phone details are never shown publicly. They are shared only after an owner approves a request.',
  'Found items carry a private verification question, so only the real owner can claim them.',
  'Open listings expire automatically after 90 days.',
];

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-sm text-muted">{label}</dt>
      <dd className="mt-1 font-serif text-4xl font-medium">{value}</dd>
    </div>
  );
}

export default function Landing() {
  const active = useAsync((signal) => api.listItems({}, signal), []);
  const resolved = useAsync((signal) => api.listItems({ status: 'resolved' }, signal), []);

  const items = active.data ?? [];
  const latest = items.slice(0, 5);
  const returned = resolved.data ?? [];
  const fmt = (loading: boolean, n: number) => (loading ? '—' : String(n));

  return (
    <div>
      <section className="border-b border-line">
        <div className="container-page grid gap-12 py-16 lg:grid-cols-12 lg:py-24">
          <div className="lg:col-span-7">
            <p className="text-sm font-medium text-muted">MNNIT Allahabad · Lost &amp; Found</p>
            <h1 className="mt-4 text-4xl font-medium leading-[1.08] sm:text-5xl lg:text-6xl">
              Lost something on campus? Let’s get it back to you.
            </h1>
            <p className="mt-6 max-w-xl text-lg text-muted">
              ReturnIt is the community board for lost and found belongings at MNNIT. Post what you’ve lost, list what you’ve found, and hand things back to their owners safely.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link to="/dashboard" className="btn-primary h-11 px-5">
                Browse listings <ArrowRight size={16} aria-hidden />
              </Link>
              <Link to="/post" className="btn-secondary h-11 px-5">Post an item</Link>
            </div>
            <p className="mt-4 text-sm text-muted">Posting and claiming require signing in with your @mnnit.ac.in account.</p>
          </div>

          <aside className="lg:col-span-5" aria-labelledby="board-heading">
            <div className="rounded-lg border border-line bg-surface">
              <div className="flex items-center justify-between border-b border-line px-5 py-4">
                <h2 id="board-heading" className="font-serif text-xl font-medium">Latest on the board</h2>
                <Link to="/dashboard" className="text-sm font-medium text-accent hover:underline">View all</Link>
              </div>
              {active.loading ? (
                <p className="px-5 py-8 text-sm text-muted" role="status">Loading…</p>
              ) : latest.length === 0 ? (
                <p className="px-5 py-8 text-sm text-muted">Nothing has been posted yet. Be the first to post an item.</p>
              ) : (
                <ul className="divide-y divide-line">
                  {latest.map((i) => (
                    <li key={i.id}>
                      <Link to={`/items/${i.id}`} className="grid grid-cols-[4.5rem_1fr_auto] items-baseline gap-3 px-5 py-3.5 hover:bg-paper">
                        <TypeLabel type={i.type} />
                        <span className="min-w-0">
                          <span className="block truncate text-sm font-medium">{i.title}</span>
                          <span className="block truncate text-xs text-muted">{i.locationLabel}</span>
                        </span>
                        <span className="text-xs text-muted">{timeAgo(i.createdAt)}</span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </aside>
        </div>

        <div className="border-t border-line bg-surface/60">
          <dl className="container-page grid grid-cols-3 gap-6 py-8">
            <Stat label="Open listings" value={fmt(active.loading, items.length)} />
            <Stat label="Found items waiting" value={fmt(active.loading, items.filter((i) => i.type === 'found').length)} />
            <Stat label="Returned to owners" value={fmt(resolved.loading, returned.length)} />
          </dl>
        </div>
      </section>

      <section className="container-page py-16 lg:py-20" aria-labelledby="how-heading">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 id="how-heading" className="max-w-md text-3xl font-medium sm:text-4xl">How it works</h2>
          <Link to="/safety" className="text-sm font-medium text-accent hover:underline">Read the full guide</Link>
        </div>
        <ol className="mt-10 grid gap-10 md:grid-cols-3">
          {STEPS.map((s) => (
            <li key={s.n} className="border-t border-ink pt-5">
              <span className="font-serif text-2xl text-muted">{s.n}</span>
              <h3 className="mt-3 text-xl font-medium">{s.title}</h3>
              <p className="mt-2 text-sm text-muted">{s.body}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="border-y border-line bg-surface/60" aria-labelledby="trust-heading">
        <div className="container-page grid gap-10 py-16 lg:grid-cols-2 lg:py-20">
          <div>
            <h2 id="trust-heading" className="text-3xl font-medium sm:text-4xl">Built for one campus, so it can be trusted.</h2>
            <p className="mt-4 max-w-md text-muted">
              Because everyone on ReturnIt is a verified member of the MNNIT community, listings stay relevant and accountable.
            </p>
          </div>
          <ul className="space-y-4">
            {ASSURANCES.map((a) => (
              <li key={a} className="flex gap-3 text-sm">
                <Check size={18} className="mt-0.5 shrink-0 text-accent" aria-hidden />
                <span>{a}</span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {returned.length > 0 && (
        <section className="container-page py-16 lg:py-20" aria-labelledby="returned-heading">
          <h2 id="returned-heading" className="text-3xl font-medium sm:text-4xl">Recently returned</h2>
          <ul className="mt-8 divide-y divide-line border-y border-line">
            {returned.slice(0, 4).map((i) => (
              <li key={i.id} className="flex flex-wrap items-center justify-between gap-2 py-4">
                <div className="min-w-0">
                  <p className="truncate font-medium">{i.title}</p>
                  <p className="truncate text-sm text-muted">{i.locationLabel}</p>
                </div>
                <span className="flex items-center gap-1.5 text-sm font-medium text-accent">
                  <Check size={16} aria-hidden /> Returned
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-accent text-white">
        <div className="container-page flex flex-wrap items-center justify-between gap-6 py-14">
          <div>
            <h2 className="text-3xl font-medium text-white">Found something? Post it in a minute.</h2>
            <p className="mt-2 text-white/80">Someone on campus is probably looking for it right now.</p>
          </div>
          <Link to="/post?type=found" className="btn h-11 bg-white px-5 text-accent hover:bg-paper">Post a found item</Link>
        </div>
      </section>
    </div>
  );
}
