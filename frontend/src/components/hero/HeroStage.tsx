import { lazy, Suspense, useEffect, useState } from 'react';
import { useReducedMotion } from 'motion/react';
import { Backpack, BookOpen, Headphones, IdCard, KeyRound } from 'lucide-react';
import { useMediaQuery } from '../../hooks/useMediaQuery';

const HeroCanvas = lazy(() => import('./HeroCanvas'));

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return Boolean(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

/** Static composition shown when WebGL is unavailable. */
function HeroFallback({ compact }: { compact: boolean }) {
  const tiles = [
    { Icon: Backpack, className: 'left-[46%] top-[34%] h-36 w-36 -rotate-6 bg-cobalt text-white', size: 64 },
    { Icon: Headphones, className: 'left-[22%] top-[14%] h-24 w-24 rotate-12 bg-paper text-ink', size: 40 },
    { Icon: KeyRound, className: 'left-[18%] top-[62%] h-20 w-20 -rotate-12 bg-coral text-ink', size: 34 },
    { Icon: IdCard, className: 'left-[74%] top-[18%] h-24 w-28 rotate-6 bg-paper text-cobalt', size: 40 },
    { Icon: BookOpen, className: 'left-[76%] top-[62%] h-24 w-20 rotate-[-8deg] bg-lime text-ink', size: 36 },
  ];
  return (
    <div aria-hidden className="absolute inset-0">
      {tiles.slice(0, compact ? 4 : 5).map(({ Icon, className, size }, i) => (
        <span
          key={i}
          className={`absolute grid animate-drift place-items-center rounded-[1.75rem] shadow-pop ${className}`}
          style={{ animationDelay: `${i * -1.3}s` }}
        >
          <Icon size={size} strokeWidth={1.4} />
        </span>
      ))}
    </div>
  );
}

/**
 * Decides how to render the hero's spatial layer: a lazily-loaded WebGL scene when supported,
 * otherwise a CSS composition. Loading waits for an idle moment so the headline paints first.
 */
export default function HeroStage({ compact }: { compact: boolean }) {
  const [mode, setMode] = useState<'pending' | 'webgl' | 'fallback'>('pending');
  const reduced = Boolean(useReducedMotion());
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');

  useEffect(() => {
    const decide = () => setMode(webglAvailable() ? 'webgl' : 'fallback');
    // Safari has no requestIdleCallback; a short timeout serves the same purpose there.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(decide, { timeout: 600 });
      return () => window.cancelIdleCallback(id);
    }
    const id = setTimeout(decide, 120);
    return () => clearTimeout(id);
  }, []);

  if (mode === 'fallback') return <HeroFallback compact={compact} />;
  if (mode === 'pending') return null;
  return (
    <Suspense fallback={null}>
      <HeroCanvas compact={compact} reducedMotion={reduced} interactive={finePointer && !compact} />
    </Suspense>
  );
}
