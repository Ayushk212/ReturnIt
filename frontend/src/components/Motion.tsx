import { useRef, type ReactNode } from 'react';
import { m, useReducedMotion, useSpring, type HTMLMotionProps } from 'motion/react';
import { useMediaQuery } from '../hooks/useMediaQuery';
import { fadeUp, revealViewport, softSpring, stagger } from '../lib/motion';

/** Fades and lifts its content into place once, when it scrolls into view. */
export function Reveal({ delay, className, children, ...rest }: HTMLMotionProps<'div'> & { delay?: number }) {
  return (
    <m.div initial="hidden" whileInView="show" viewport={revealViewport} variants={fadeUp} custom={delay} className={className} {...rest}>
      {children}
    </m.div>
  );
}

/** Staggers the reveal of direct `RevealItem` children. */
export function RevealGroup({ gap = 0.07, delay = 0, className, children, ...rest }: HTMLMotionProps<'div'> & { gap?: number; delay?: number }) {
  return (
    <m.div initial="hidden" whileInView="show" viewport={revealViewport} variants={stagger(gap, delay)} className={className} {...rest}>
      {children}
    </m.div>
  );
}

export function RevealItem({ className, children, ...rest }: HTMLMotionProps<'div'>) {
  return (
    <m.div variants={fadeUp} className={className} {...rest}>
      {children}
    </m.div>
  );
}

/** Pulls its child gently toward the pointer. Disabled for touch input and reduced motion. */
export function Magnetic({ children, strength = 0.22, className = '' }: { children: ReactNode; strength?: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);
  const x = useSpring(0, softSpring);
  const y = useSpring(0, softSpring);
  const finePointer = useMediaQuery('(hover: hover) and (pointer: fine)');
  const reduced = useReducedMotion();
  const enabled = finePointer && !reduced;

  return (
    <m.span
      ref={ref}
      style={enabled ? { x, y } : undefined}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!enabled || !el) return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
      className={`inline-flex ${className}`}
    >
      {children}
    </m.span>
  );
}
