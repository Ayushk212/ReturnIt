import type { ReactNode } from 'react';
import { m } from 'motion/react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { EASE_OUT } from '../lib/motion';
import HeroStage from './hero/HeroStage';

interface Props {
  eyebrow: ReactNode;
  title: ReactNode;
  description?: ReactNode;
  /** Buttons or other actions under the description. */
  actions?: ReactNode;
  /** Optional content in place of the 3D scene (e.g. a profile card). */
  aside?: ReactNode;
  children?: ReactNode;
}

/**
 * Dark, immersive header shared by the secondary pages. On large screens it carries a compact
 * version of the homepage 3D scene; it is lazy-loaded and skipped on small screens.
 */
export default function PageBanner({ eyebrow, title, description, actions, aside, children }: Props) {
  const desktop = useMediaQuery('(min-width: 1024px)');
  return (
    <section className="on-dark grain relative isolate overflow-hidden bg-night text-white">
      <div aria-hidden className="absolute inset-0 -z-10">
        <div className="absolute -right-[10%] -top-[40%] h-[40rem] w-[40rem] rounded-full bg-[radial-gradient(closest-side,rgba(47,69,255,0.5),rgba(47,69,255,0.1)_55%,transparent)]" />
        <div className="absolute -bottom-[60%] -left-[10%] h-[30rem] w-[30rem] rounded-full bg-[radial-gradient(closest-side,rgba(200,240,74,0.12),transparent)]" />
        <div className="absolute inset-x-0 bottom-0 h-[70%] bg-[linear-gradient(rgba(255,255,255,0.05)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.05)_1px,transparent_1px)] bg-[size:56px_56px] [mask-image:linear-gradient(to_top,black,transparent)] [transform:perspective(600px)_rotateX(58deg)] [transform-origin:bottom]" />
      </div>

      {desktop && !aside && (
        <div className="absolute inset-y-0 right-0 hidden w-[44%] lg:block" aria-hidden>
          <HeroStage compact />
        </div>
      )}

      <div className="container-page relative grid grid-cols-1 items-end gap-8 pb-12 pt-28 sm:pt-32 lg:min-h-[24rem] lg:grid-cols-12 lg:pb-16">
        <m.div
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: EASE_OUT }}
          className={aside ? 'lg:col-span-7' : 'lg:col-span-7 xl:col-span-6'}
        >
          <p className="eyebrow inline-flex items-center gap-2 text-white/55">{eyebrow}</p>
          <h1 className="mt-4 text-display-xl font-bold">{title}</h1>
          {description && <p className="mt-4 max-w-xl text-base leading-relaxed text-white/65 sm:text-lg">{description}</p>}
          {actions && <div className="mt-7 flex flex-wrap items-center gap-3">{actions}</div>}
        </m.div>
        {aside && (
          <m.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, ease: EASE_OUT, delay: 0.1 }}
            className="lg:col-span-5"
          >
            {aside}
          </m.div>
        )}
      </div>
      {children}
    </section>
  );
}
