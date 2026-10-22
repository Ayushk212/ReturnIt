import { BookOpen, Briefcase, FileText, Gem, KeyRound, Package, Shirt, Smartphone, type LucideIcon } from 'lucide-react';
import { CATEGORIES } from './constants';

export type Tone = 'cobalt' | 'lime' | 'coral' | 'sand';

const META: Record<string, { icon: LucideIcon; tone: Tone }> = {
  electronics: { icon: Smartphone, tone: 'cobalt' },
  documents: { icon: FileText, tone: 'lime' },
  'wallets-bags': { icon: Briefcase, tone: 'coral' },
  keys: { icon: KeyRound, tone: 'sand' },
  jewelry: { icon: Gem, tone: 'cobalt' },
  clothing: { icon: Shirt, tone: 'coral' },
  books: { icon: BookOpen, tone: 'lime' },
  other: { icon: Package, tone: 'sand' },
};

export function categoryMeta(value: string): { icon: LucideIcon; tone: Tone } {
  return META[value] ?? META.other;
}

export function categoryLabel(value: string): string {
  return CATEGORIES.find((c) => c.value === value)?.label ?? 'Other';
}

/** Tailwind classes per tone: tinted surface, ink for icons/text, and a pattern colour. */
export const TONE_CLASSES: Record<Tone, { surface: string; ink: string; dot: string }> = {
  cobalt: { surface: 'bg-cobalt-soft', ink: 'text-cobalt-ink', dot: 'text-cobalt/30' },
  lime: { surface: 'bg-lime-soft', ink: 'text-lime-ink', dot: 'text-lime-ink/25' },
  coral: { surface: 'bg-coral-soft', ink: 'text-coral-ink', dot: 'text-coral-ink/20' },
  sand: { surface: 'bg-paper-deep', ink: 'text-ink-soft', dot: 'text-ink/15' },
};
