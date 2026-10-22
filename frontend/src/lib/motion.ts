import type { Transition, Variants } from 'motion/react';

/** Shared motion language: quick, confident ease-out with a soft landing. */
export const EASE_OUT: [number, number, number, number] = [0.22, 1, 0.36, 1];

export const spring: Transition = { type: 'spring', stiffness: 420, damping: 32, mass: 0.8 };
export const softSpring: Transition = { type: 'spring', stiffness: 160, damping: 22 };

// `custom` may carry a delay. It is only set when given, so a parent's stagger still applies.
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 18 },
  show: (delay?: number) => ({ opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE_OUT, ...(delay ? { delay } : {}) } }),
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.6, ease: EASE_OUT } },
};

export const stagger = (gap = 0.07, delay = 0): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: gap, delayChildren: delay } },
});

/** Viewport settings for scroll reveals: trigger once, slightly before fully in view. */
export const revealViewport = { once: true, margin: '0px 0px -12% 0px' } as const;
