import { Link } from 'react-router-dom';
import { ArrowRight, PackageCheck, Search, type LucideIcon } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '../Motion';

interface Journey {
  tone: 'coral' | 'lime';
  icon: LucideIcon;
  kicker: string;
  title: string;
  body: string;
  primary: { to: string; label: string };
  secondary: { to: string; label: string };
}

const JOURNEYS: Journey[] = [
  {
    tone: 'coral',
    icon: Search,
    kicker: 'If you lost it',
    title: 'Check the found items first.',
    body: 'Someone may already have found it. Browse found items first, then post a lost report so finders know what to look for.',
    primary: { to: '/dashboard?type=found', label: 'Browse found items' },
    secondary: { to: '/post?type=lost', label: 'Report a lost item' },
  },
  {
    tone: 'lime',
    icon: PackageCheck,
    kicker: 'If you found it',
    title: 'Report it and verify the owner.',
    body: 'List what you found with a private question only the real owner could answer. It takes about a minute.',
    primary: { to: '/post?type=found', label: 'Post a found item' },
    secondary: { to: '/dashboard?type=lost', label: 'Browse lost reports' },
  },
];

export default function Journeys() {
  return (
    <section aria-labelledby="journeys-heading" className="container-page py-20 sm:py-28">
      <Reveal className="grid items-end gap-6 lg:grid-cols-12">
        <h2 id="journeys-heading" className="text-display-lg font-bold lg:col-span-7">
          Two ways to <span className="font-serif font-normal italic">get started.</span>
        </h2>
        <p className="max-w-md text-muted lg:col-span-5 lg:justify-self-end">
          Choose the option that matches your situation. Both take less than a minute.
        </p>
      </Reveal>

      <RevealGroup className="mt-10 grid gap-4 md:grid-cols-2" gap={0.12}>
        {JOURNEYS.map((j) => (
          <RevealItem key={j.kicker}>
            <article
              className={`group relative isolate flex h-full min-h-[22rem] flex-col overflow-hidden rounded-panel p-7 text-ink transition duration-500 ease-out hover:-translate-y-1 sm:p-9 ${
                j.tone === 'coral' ? 'bg-coral' : 'bg-lime'
              }`}
            >
              <j.icon
                aria-hidden
                strokeWidth={1.1}
                className="absolute -bottom-10 -right-8 -z-10 h-64 w-64 text-ink/[0.08] transition-transform duration-700 ease-out group-hover:-rotate-6 group-hover:scale-105"
              />
              <p className="eyebrow text-ink/60">{j.kicker}</p>
              <h3 className="mt-4 max-w-sm text-display-md font-bold">{j.title}</h3>
              <p className="mt-4 max-w-md text-[15px] leading-relaxed text-ink/75">{j.body}</p>
              <div className="mt-auto flex flex-wrap items-center gap-x-5 gap-y-3 pt-8">
                <Link to={j.primary.to} className="btn-ink">
                  {j.primary.label} <ArrowRight size={16} aria-hidden />
                </Link>
                <Link to={j.secondary.to} className="text-sm font-semibold underline decoration-ink/30 underline-offset-4 transition-colors hover:decoration-ink">
                  {j.secondary.label}
                </Link>
              </div>
            </article>
          </RevealItem>
        ))}
      </RevealGroup>
    </section>
  );
}
