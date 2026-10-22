import { AtSign, CircleCheck, EyeOff, LockKeyhole, MapPin, Timer, type LucideIcon } from 'lucide-react';
import type { Item } from '../../lib/types';
import { Reveal, RevealGroup, RevealItem } from '../Motion';

const ASSURANCES: { icon: LucideIcon; text: string }[] = [
  { icon: AtSign, text: 'Sign-in is limited to @mnnit.ac.in accounts.' },
  { icon: EyeOff, text: 'Email and phone details are never shown publicly. They are shared only after an owner approves a request.' },
  { icon: LockKeyhole, text: 'Found items carry a private verification question, so only the real owner can claim them.' },
  { icon: Timer, text: 'Open listings expire automatically after 90 days.' },
];

export default function Trust({ returned }: { returned: Item[] }) {
  return (
    <section aria-labelledby="trust-heading" className="container-page py-20 sm:py-28">
      <div className="grid gap-12 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <p className="eyebrow text-muted">Trust &amp; privacy</p>
          <h2 id="trust-heading" className="mt-3 text-display-lg font-bold">Built for one campus, so it can be trusted.</h2>
          <p className="mt-5 max-w-md text-muted">
            Because everyone on ReturnIt is a verified member of the MNNIT community, listings stay relevant and accountable.
          </p>
        </Reveal>

        <RevealGroup className="grid gap-3 sm:grid-cols-2 lg:col-span-7" gap={0.08}>
          {ASSURANCES.map((a, i) => (
            <RevealItem key={a.text} className="card flex flex-col gap-5 p-6">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${i % 2 === 0 ? 'bg-cobalt-soft text-cobalt-ink' : 'bg-lime-soft text-lime-ink'}`}>
                <a.icon size={20} strokeWidth={1.8} aria-hidden />
              </span>
              <p className="text-[15px] leading-relaxed">{a.text}</p>
            </RevealItem>
          ))}
        </RevealGroup>
      </div>

      {returned.length > 0 && (
        <Reveal className="mt-20">
          <div className="flex flex-wrap items-end justify-between gap-4 border-b border-ink pb-4">
            <h3 id="returned-heading" className="text-display-md font-bold">Recently returned</h3>
            <p className="eyebrow text-muted">Closed listings</p>
          </div>
          <ul aria-labelledby="returned-heading" className="divide-y divide-line">
            {returned.slice(0, 4).map((i) => (
              <li key={i.id} className="grid grid-cols-[1fr_auto] items-center gap-4 py-4 sm:grid-cols-[1fr_16rem_auto]">
                <p className="truncate font-display text-lg font-semibold tracking-tight">{i.title}</p>
                <p className="hidden items-center gap-1.5 truncate text-sm text-muted sm:flex">
                  <MapPin size={14} aria-hidden className="shrink-0" /> {i.locationLabel}
                </p>
                <span className="chip bg-lime-soft py-1.5 font-semibold text-lime-ink">
                  <CircleCheck size={13} aria-hidden /> Returned
                </span>
              </li>
            ))}
          </ul>
        </Reveal>
      )}
    </section>
  );
}
