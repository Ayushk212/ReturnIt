import { Link } from 'react-router-dom';
import { ArrowRight, Handshake, ImagePlus, MailCheck, Plus, Send, ShieldAlert, type LucideIcon } from 'lucide-react';
import { Reveal, RevealGroup, RevealItem } from '../components/Motion';

const STEPS: { title: string; body: string; icon: LucideIcon }[] = [
  { title: 'Post the item', body: 'Describe what was lost or found, add a photo if you have one, and say where and when. Finders also write a private question that only the true owner could answer.', icon: ImagePlus },
  { title: 'Send a request', body: 'Open a listing and send a request. Owners answer the finder’s question; finders say where they found the item and how they can hand it over.', icon: Send },
  { title: 'Approval and contact', body: 'The person who posted the listing reviews the request. Only when they approve are email addresses shared, and only between those two people.', icon: MailCheck },
  { title: 'Meet and close the listing', body: 'Hand the item over in a public place on campus, then mark the listing as resolved so it leaves the board.', icon: Handshake },
];

const GUIDELINES = [
  'Meet in a public, well-lit place on campus, such as the library entrance or the main building lobby.',
  'Never share OTPs, passwords or bank details. Nobody needs them to return an item.',
  'Do not put the answer to your verification question in the listing description.',
  'Report anything that feels wrong to a hostel warden or campus security.',
];

const FAQ = [
  { q: 'Who can use ReturnIt?', a: 'Anyone can browse the board. To open a listing, post, or send a request, you must sign in with an @mnnit.ac.in account.' },
  { q: 'Why do I have to sign in to open a listing?', a: 'It keeps the community accountable and stops the board from being scraped or used for spam.' },
  { q: 'When are my contact details shared?', a: 'Only after the owner of a listing approves a request, and only with the person who made it. They are never shown publicly.' },
  { q: 'What happens if nobody responds?', a: 'Open listings expire automatically after 90 days. You can post again at any time.' },
];

export default function Safety() {
  return (
    <div className="pb-24">
      <header className="container-page max-w-page">
        <Reveal className="max-w-3xl">
          <p className="eyebrow text-muted">How it works</p>
          <h1 className="mt-3 text-display-xl font-bold">
            A simple process, built around <span className="font-serif font-normal italic">trust.</span>
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-muted">
            ReturnIt connects people who lost something with people who found it, without exposing anyone’s personal details along the way.
          </p>
        </Reveal>
      </header>

      <section aria-label="Steps" className="container-page mt-14">
        <RevealGroup gap={0.1} className="relative grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div aria-hidden className="absolute left-0 right-0 top-[3.25rem] hidden h-px bg-line-strong xl:block" />
          {STEPS.map((s, i) => (
            <RevealItem key={s.title} className="relative">
              <article className="card relative flex h-full flex-col p-6 sm:p-7">
                <div className="flex items-center justify-between">
                  <span className={`grid h-12 w-12 -rotate-6 place-items-center rounded-2xl ${i === STEPS.length - 1 ? 'bg-lime text-ink' : 'bg-night text-white'}`}>
                    <s.icon size={22} strokeWidth={1.7} aria-hidden />
                  </span>
                  <span className="font-display text-5xl font-bold tracking-tighter text-ink/10">{String(i + 1).padStart(2, '0')}</span>
                </div>
                <h2 className="mt-8 text-xl font-semibold tracking-tight">{s.title}</h2>
                <p className="mt-2 text-sm leading-relaxed text-muted">{s.body}</p>
              </article>
            </RevealItem>
          ))}
        </RevealGroup>
      </section>

      <div className="container-page mt-16 grid gap-6 lg:grid-cols-12">
        <Reveal className="lg:col-span-5">
          <section aria-labelledby="safety-heading" className="on-dark grain relative h-full overflow-hidden rounded-panel bg-night p-7 text-white sm:p-9">
            <div aria-hidden className="absolute -right-24 -top-24 h-72 w-72 rounded-full bg-cobalt/40 blur-[90px]" />
            <span className="relative grid h-12 w-12 place-items-center rounded-2xl bg-coral text-ink" aria-hidden>
              <ShieldAlert size={22} />
            </span>
            <h2 id="safety-heading" className="relative mt-6 text-display-md font-bold">Safety guidelines</h2>
            <ul className="relative mt-6 space-y-4 text-sm leading-relaxed text-white/75">
              {GUIDELINES.map((g, i) => (
                <li key={g} className="flex gap-4 border-t border-white/10 pt-4">
                  <span className="font-mono text-xs text-lime">{String(i + 1).padStart(2, '0')}</span>
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </section>
        </Reveal>

        <Reveal className="lg:col-span-7" delay={0.1}>
          <section aria-labelledby="faq-heading" className="card h-full p-7 sm:p-9">
            <h2 id="faq-heading" className="text-display-md font-bold">Common questions</h2>
            <div className="mt-6 divide-y divide-line border-y border-line">
              {FAQ.map((f) => (
                <details key={f.q} className="group py-1">
                  <summary className="flex cursor-pointer list-none items-center justify-between gap-4 rounded-lg py-4 font-semibold">
                    {f.q}
                    <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full border border-line transition duration-300 group-open:rotate-45 group-open:border-ink group-open:bg-ink group-open:text-white">
                      <Plus size={16} />
                    </span>
                  </summary>
                  <p className="pb-5 pr-12 text-sm leading-relaxed text-muted">{f.a}</p>
                </details>
              ))}
            </div>
          </section>
        </Reveal>
      </div>

      <Reveal className="container-page mt-14 flex flex-wrap gap-3">
        <Link to="/dashboard" className="btn-primary btn-lg">
          Browse listings <ArrowRight size={18} aria-hidden />
        </Link>
        <Link to="/post" className="btn-secondary btn-lg">Post an item</Link>
      </Reveal>
    </div>
  );
}
