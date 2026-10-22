import { useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { m, useMotionValueEvent, useScroll, useSpring } from 'motion/react';
import { ArrowRight, Handshake, ImagePlus, LockKeyhole, MapPin, Send, ShieldCheck, type LucideIcon } from 'lucide-react';
import { EASE_OUT } from '../../lib/motion';
import { Reveal } from '../Motion';

interface Step {
  title: string;
  body: string;
  icon: LucideIcon;
  details: { icon: LucideIcon; text: string }[];
}

const STEPS: Step[] = [
  {
    title: 'Post it',
    body: 'Report what you lost or found with the place, the date and a photo if you have one. It takes about a minute.',
    icon: ImagePlus,
    details: [
      { icon: MapPin, text: 'Pick the spot on campus' },
      { icon: ImagePlus, text: 'Up to five photos' },
    ],
  },
  {
    title: 'Send a request',
    body: 'Listings are visible to everyone, and opening one needs a campus sign-in. Owners and finders connect through a request, not a public comment thread.',
    icon: Send,
    details: [
      { icon: ShieldCheck, text: '@mnnit.ac.in accounts only' },
      { icon: LockKeyhole, text: 'No public comments' },
    ],
  },
  {
    title: 'Verify and hand over',
    body: 'Finders set a private question that only the real owner can answer. Once a request is approved, you share contact details and meet in a public spot.',
    icon: Handshake,
    details: [
      { icon: LockKeyhole, text: 'Private verification question' },
      { icon: Handshake, text: 'Contact shared after approval' },
    ],
  },
];

export default function HowItWorks() {
  const listRef = useRef<HTMLOListElement>(null);
  const [active, setActive] = useState(0);
  const { scrollYProgress } = useScroll({ target: listRef, offset: ['start 0.65', 'end 0.65'] });
  const progress = useSpring(scrollYProgress, { stiffness: 140, damping: 30, mass: 0.4 });
  useMotionValueEvent(scrollYProgress, 'change', (v) => {
    setActive(Math.min(STEPS.length - 1, Math.max(0, Math.floor(v * STEPS.length))));
  });

  return (
    // overflow-clip (not hidden) so the sticky column still sticks to the viewport.
    <section aria-labelledby="how-heading" className="on-dark grain relative isolate overflow-clip bg-night text-white">
      <div aria-hidden className="absolute -left-40 top-1/3 -z-10 h-[36rem] w-[36rem] rounded-full bg-cobalt/25 blur-[120px]" />
      <div className="container-page grid gap-12 py-24 sm:py-32 lg:grid-cols-12">
        <div className="lg:col-span-5">
          <div className="lg:sticky lg:top-32">
            <Reveal>
              <p className="eyebrow text-white/45">How it works</p>
              <h2 id="how-heading" className="mt-4 text-display-lg font-bold">
                From lost to <span className="font-serif font-normal italic text-lime">found</span> in three steps.
              </h2>
              <p className="mt-5 max-w-md text-white/60">
                ReturnIt replaces group chats and noticeboards with a structured, private process between two verified members of the campus community.
              </p>
            </Reveal>

            <div className="mt-10 hidden gap-5 lg:flex">
              <div className="relative w-px bg-white/10" aria-hidden>
                <m.div style={{ scaleY: progress }} className="absolute inset-0 origin-top bg-lime" />
              </div>
              <ol className="space-y-4" aria-label="Steps">
                {STEPS.map((s, i) => (
                  <li key={s.title} className={`flex items-baseline gap-4 transition-colors duration-500 ${active === i ? 'text-white' : 'text-white/35'}`}>
                    <span className="font-mono text-xs">{String(i + 1).padStart(2, '0')}</span>
                    <span className="font-display text-xl font-semibold tracking-tight">{s.title}</span>
                  </li>
                ))}
              </ol>
            </div>

            <Link to="/safety" className="group mt-10 inline-flex items-center gap-2 text-sm font-semibold text-lime">
              Read the complete guide
              <ArrowRight size={16} aria-hidden className="transition-transform group-hover:translate-x-1" />
            </Link>
          </div>
        </div>

        <ol ref={listRef} className="space-y-5 lg:col-span-6 lg:col-start-7">
          {STEPS.map((s, i) => (
            <m.li
              key={s.title}
              initial={{ opacity: 0, y: 40 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true, margin: '0px 0px -15% 0px' }}
              transition={{ duration: 0.7, ease: EASE_OUT }}
              className={`relative overflow-hidden rounded-panel border p-7 transition-colors duration-500 sm:p-9 lg:min-h-[24rem] ${
                active === i ? 'border-white/20 bg-white/[0.06]' : 'border-white/10 bg-white/[0.025]'
              }`}
            >
              <div className="flex items-start justify-between gap-6">
                <span className="font-display text-7xl font-bold leading-none tracking-tighter text-white/10 sm:text-8xl">{String(i + 1).padStart(2, '0')}</span>
                <span className={`grid h-16 w-16 -rotate-6 place-items-center rounded-2xl transition-colors duration-500 ${active === i ? 'bg-lime text-ink' : 'bg-white/10 text-white'}`}>
                  <s.icon size={28} strokeWidth={1.6} aria-hidden />
                </span>
              </div>
              <h3 className="mt-10 text-display-md font-bold">{s.title}</h3>
              <p className="mt-3 max-w-lg leading-relaxed text-white/60">{s.body}</p>
              <ul className="mt-7 flex flex-wrap gap-2">
                {s.details.map((d) => (
                  <li key={d.text} className="chip border border-white/15 bg-white/[0.04] py-1.5 text-white/75">
                    <d.icon size={12} aria-hidden /> {d.text}
                  </li>
                ))}
              </ul>
            </m.li>
          ))}
        </ol>
      </div>
    </section>
  );
}
