import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight } from 'lucide-react';
import { categoryLabel } from '../../lib/categoryMeta';
import { createHeroScene } from './scene';

interface Props {
  compact: boolean;
  reducedMotion: boolean;
  interactive: boolean;
}

/** WebGL canvas for the hero. Loaded lazily so three.js never blocks the first paint. */
export default function HeroCanvas({ compact, reducedMotion, interactive }: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const labelRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [hovered, setHovered] = useState<string | null>(null);
  const navigate = useNavigate();
  const navigateRef = useRef(navigate);
  navigateRef.current = navigate;

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return undefined;
    // A fresh canvas per mount gives each renderer its own WebGL context.
    const canvas = document.createElement('canvas');
    canvas.className = 'block h-full w-full';
    host.appendChild(canvas);
    let handle: ReturnType<typeof createHeroScene>;
    try {
      handle = createHeroScene({
        canvas,
        compact,
        reducedMotion,
        interactive,
        onHover: setHovered,
        onSelect: (category) => navigateRef.current(`/dashboard?category=${encodeURIComponent(category)}`),
        onFirstFrame: () => setReady(true),
      });
    } catch {
      canvas.remove();
      return undefined; // WebGL failed at runtime; the CSS backdrop stays visible.
    }

    const section = canvas.closest('section');
    const onScroll = () => handle.setScroll(window.scrollY / Math.max(section?.offsetHeight ?? window.innerHeight, 1));
    const onMove = (e: PointerEvent) => {
      handle.setPointer(e.clientX, e.clientY);
      if (labelRef.current) labelRef.current.style.transform = `translate3d(${e.clientX + 18}px, ${e.clientY + 18}px, 0)`;
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      window.removeEventListener('pointermove', onMove);
      handle.dispose();
      canvas.remove();
    };
  }, [compact, reducedMotion, interactive]);

  return (
    <>
      <div ref={hostRef} aria-hidden className={`h-full w-full transition-opacity duration-1000 ease-out ${ready ? 'opacity-100' : 'opacity-0'}`} />
      {interactive && (
        <div
          ref={labelRef}
          aria-hidden
          className={`pointer-events-none fixed left-0 top-0 z-40 transition-opacity duration-200 ${hovered ? 'opacity-100' : 'opacity-0'}`}
        >
          <span className="chip bg-lime py-1.5 font-semibold text-ink shadow-glow">
            Browse {hovered === 'other' ? 'other items' : categoryLabel(hovered ?? 'other')} <ArrowUpRight size={12} strokeWidth={2.5} />
          </span>
        </div>
      )}
    </>
  );
}
