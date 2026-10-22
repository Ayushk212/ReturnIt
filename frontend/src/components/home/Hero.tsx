import { useRef, useState, type FormEvent, type ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { m, useReducedMotion, useScroll, useTransform, type MotionValue } from 'motion/react';
import { ArrowRight, ArrowUpRight, MapPin, PackageCheck, Search } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';
import { timeAgo } from '../../lib/format';
import { EASE_OUT } from '../../lib/motion';
import type { Item } from '../../lib/types';
import HeroStage from '../hero/HeroStage';
import { TagMark } from '../Logo';
import { Magnetic } from '../Motion';
import TypeLabel from '../TypeLabel';

interface Props {
  latest: Item[];
}

function Line({ children, delay }: { children: ReactNode; delay: number }) {
  return (
    <span className="block overflow-hidden pb-[0.1em] -mb-[0.1em]">
      <m.span className="block" initial={{ y: '108%' }} animate={{ y: 0 }} transition={{ duration: 0.95, ease: EASE_OUT, delay }}>
        {children}
      </m.span>
    </span>
  );
}

function FloatingTag({ item, className, rotate, delay, y }: { item: Item; className: string; rotate: number; delay: number; y?: MotionValue<number> }) {
  return (
    <m.div
      style={y ? { y } : undefined}
      initial={{ opacity: 0, scale: 0.92, rotate: rotate - 6 }}
      animate={{ opacity: 1, scale: 1, rotate }}
      transition={{ duration: 0.9, ease: EASE_OUT, delay }}
      className={`pointer-events-auto absolute ${className}`}
    >
      <div className="animate-drift" style={{ animationDelay: `${delay * -3}s` }}>
        {/* The string the tag hangs from */}
        <span aria-hidden className="absolute -top-14 left-1/2 h-14 w-px bg-gradient-to-b from-transparent to-white/40" />
        <Link
          to={`/items/${item.id}`}
          className="group relative block w-64 rounded-2xl bg-paper p-3.5 text-ink shadow-pop ring-1 ring-black/5 transition duration-300 ease-out hover:-translate-y-1 hover:rotate-1"
        >
          <span aria-hidden className="absolute left-1/2 top-2.5 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-night/80 ring-2 ring-paper-deep" />
          <span className="flex items-center justify-between pt-3">
            <TypeLabel type={item.type} />
            <span className="eyebrow text-muted">{timeAgo(item.createdAt)}</span>
          </span>
          <span className="mt-3 block font-display text-lg font-semibold leading-tight tracking-tight">{item.title}</span>
          <span className="mt-1.5 flex items-center gap-1.5 text-xs text-muted">
            <MapPin size={13} aria-hidden /> <span className="truncate">{item.locationLabel}</span>
          </span>
          <span className="perforation mt-3 block" aria-hidden />
          <span className="eyebrow mt-2.5 flex items-center justify-between text-muted">
            On the board
            <ArrowUpRight size={14} aria-hidden className="text-ink transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5" />
          </span>
        </Link>
      </div>
    </m.div>
  );
}

export default function Hero({ latest }: Props) {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');
  const ref = useRef<HTMLElement>(null);
  const desktop = useMediaQuery('(min-width: 1024px)');
  const reduced = useReducedMotion();

  const { scrollYProgress } = useScroll({ target: ref, offset: ['start start', 'end start'] });
  const copyY = useTransform(scrollYProgress, [0, 1], [0, 90]);
  const copyOpacity = useTransform(scrollYProgress, [0, 0.75], [1, 0.15]);
  const tagNearY = useTransform(scrollYProgress, [0, 1], [0, -220]);
  const tagFarY = useTransform(scrollYProgress, [0, 1], [0, -110]);

  function search(e: FormEvent) {
    e.preventDefault();
    const q = query.trim();
    navigate(q ? `/dashboard?${new URLSearchParams({ q }).toString()}` : '/dashboard');
  }

  return (
    <section ref={ref} aria-labelledby="hero-heading" className="on-dark grain relative isolate flex min-h-[100svh] flex-col overflow-hidden bg-night text-white">
      {/* Backdrop: light falling on the scene, and a faint floor grid for depth. */}
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -right-[15%] -top-[25%] h-[60rem] w-[60rem] rounded-full bg-[radial-gradient(closest-side,rgba(47,69,255,0.55),rgba(47,69,255,0.12)_55%,transparent)]" />
        <div className="absolute -bottom-[30%] -left-[15%] h-[44rem] w-[44rem] rounded-full bg-[radial-gradient(closest-side,rgba(200,240,74,0.13),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:64px_64px] [mask-image:linear-gradient(to_top,black,transparent)] [transform:perspective(600px)_rotateX(58deg)] [transform-origin:bottom]" />
      </div>

      {desktop && (
        <div className="absolute inset-0">
          <HeroStage compact={false} />
        </div>
      )}

      <div className="container-page pointer-events-none relative z-10 grid flex-1 grid-cols-1 items-center gap-10 pb-10 pt-32 sm:pt-36 lg:grid-cols-12 lg:pb-16">
        <m.div style={reduced ? undefined : { y: copyY, opacity: copyOpacity }} className="pointer-events-auto lg:col-span-7 xl:col-span-6">
          <m.p
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT }}
            className="eyebrow inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/[0.04] py-1.5 pl-1.5 pr-3 text-white/70"
          >
            <TagMark className="h-5 w-5" />
            MNNIT Allahabad<span className="hidden sm:inline"> · Campus lost &amp; found</span>
          </m.p>

          <h1 id="hero-heading" className="mt-6 text-[clamp(2.7rem,0.9rem+4.7vw,5.4rem)] font-bold leading-[0.95] tracking-[-0.045em]">
            <Line delay={0.08}>Lost something </Line>
            <Line delay={0.16}>on campus? </Line>
            <Line delay={0.24}>
              Let’s bring it <span className="font-serif text-[1.08em] font-normal italic tracking-[-0.02em] text-lime">back.</span>
            </Line>
          </h1>

          <m.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.45 }}
            className="mt-6 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg"
          >
            ReturnIt helps the MNNIT community recover lost belongings. Search reported items, post what you have found, and arrange a safe handover through private messages.
          </m.p>

          <m.form
            role="search"
            onSubmit={search}
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.55 }}
            className="mt-8 flex max-w-xl items-center gap-2 rounded-full border border-white/15 bg-white/[0.06] p-1.5 pl-5 backdrop-blur-md transition-colors focus-within:border-lime/60 focus-within:bg-white/[0.09]"
          >
            <Search size={18} aria-hidden className="shrink-0 text-white/50" />
            <label htmlFor="hero-search" className="sr-only">Search the board</label>
            <input
              id="hero-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Try “wallet”, “keys” or “library”"
              className="h-11 min-w-0 flex-1 bg-transparent text-[15px] text-white outline-none placeholder:text-white/40 [&::-webkit-search-cancel-button]:invert"
            />
            <Magnetic>
              <button type="submit" className="btn-lime h-11 px-4 sm:px-5">
                <span className="hidden sm:inline">Find an item</span>
                <span className="sm:hidden">Search</span>
                <ArrowRight size={16} aria-hidden />
              </button>
            </Magnetic>
          </m.form>

          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease: EASE_OUT, delay: 0.65 }}
            className="mt-5 flex flex-wrap items-center gap-x-5 gap-y-3"
          >
            <Link to="/post?type=found" className="btn-glass">
              <PackageCheck size={16} aria-hidden /> Report something found
            </Link>
            <Link to="/post?type=lost" className="group inline-flex items-center gap-1.5 text-sm font-medium text-white/70 transition-colors hover:text-white">
              Report a lost item
              <ArrowRight size={14} aria-hidden className="transition-transform group-hover:translate-x-0.5" />
            </Link>
          </m.div>
        </m.div>

        {desktop && latest.length > 0 && (
          <div aria-label="Latest listings" role="group" className="relative hidden h-full min-h-[28rem] lg:col-span-5 lg:block xl:col-span-6">
            {latest[0] && <FloatingTag item={latest[0]} className="right-0 top-[2%]" rotate={4} delay={0.9} y={reduced ? undefined : tagNearY} />}
            {latest[1] && <FloatingTag item={latest[1]} className="bottom-[6%] left-[10%] xl:left-[16%]" rotate={-5} delay={1.05} y={reduced ? undefined : tagFarY} />}
          </div>
        )}
      </div>

      {!desktop && (
        <div className="relative -mt-4 h-[300px] sm:h-[380px]">
          <HeroStage compact />
        </div>
      )}
    </section>
  );
}
