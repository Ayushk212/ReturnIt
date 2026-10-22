import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        night: { DEFAULT: '#070B18', 800: '#0C1226', 700: '#131A33', 600: '#1E2747' },
        ink: { DEFAULT: '#0B1020', soft: '#2A3047' },
        paper: { DEFAULT: '#F4F2EC', deep: '#EAE6DB' },
        surface: '#FFFFFF',
        muted: '#596074',
        line: { DEFAULT: '#E3E0D6', strong: '#CDC8BA' },
        cobalt: { DEFAULT: '#2F45FF', dark: '#1F33D9', soft: '#E7EAFF', ink: '#1A2BB8' },
        lime: { DEFAULT: '#C8F04A', bright: '#D7FA6A', soft: '#F0FAD0', ink: '#3D6600' },
        coral: { DEFAULT: '#FF7A59', soft: '#FFE8E0', ink: '#B23A1D' },
        danger: { DEFAULT: '#C8243A', soft: '#FDECEE' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'system-ui', 'sans-serif'],
        serif: ['"Instrument Serif"', 'Georgia', 'serif'],
        sans: ['Geist', 'system-ui', 'sans-serif'],
        mono: ['"Geist Mono"', 'ui-monospace', 'SFMono-Regular', 'monospace'],
      },
      fontSize: {
        'display-2xl': ['clamp(2.9rem, 1.4rem + 5.4vw, 6.4rem)', { lineHeight: '0.94', letterSpacing: '-0.04em' }],
        'display-xl': ['clamp(2.5rem, 1.4rem + 3.8vw, 4.75rem)', { lineHeight: '0.98', letterSpacing: '-0.035em' }],
        'display-lg': ['clamp(2rem, 1.3rem + 2.4vw, 3.4rem)', { lineHeight: '1.02', letterSpacing: '-0.03em' }],
        'display-md': ['clamp(1.6rem, 1.25rem + 1.2vw, 2.25rem)', { lineHeight: '1.08', letterSpacing: '-0.025em' }],
        eyebrow: ['0.72rem', { lineHeight: '1rem', letterSpacing: '0.14em' }],
      },
      maxWidth: { page: '80rem' },
      borderRadius: { card: '1.25rem', panel: '1.75rem' },
      boxShadow: {
        lift: '0 1px 0 rgba(11,16,32,0.04), 0 18px 40px -18px rgba(11,16,32,0.28)',
        pop: '0 2px 0 rgba(11,16,32,0.05), 0 28px 60px -24px rgba(11,16,32,0.45)',
        glow: '0 0 0 1px rgba(200,240,74,0.4), 0 12px 40px -8px rgba(200,240,74,0.45)',
      },
      transitionTimingFunction: { out: 'cubic-bezier(0.22, 1, 0.36, 1)' },
      keyframes: {
        shimmer: { '0%': { backgroundPosition: '200% 0' }, '100%': { backgroundPosition: '-200% 0' } },
        drift: { '0%, 100%': { transform: 'translate3d(0, 0, 0)' }, '50%': { transform: 'translate3d(0, -10px, 0)' } },
        marquee: { '0%': { transform: 'translate3d(0, 0, 0)' }, '100%': { transform: 'translate3d(-50%, 0, 0)' } },
        'dialog-in': { '0%': { opacity: '0', transform: 'translateY(12px) scale(0.98)' }, '100%': { opacity: '1', transform: 'none' } },
      },
      animation: {
        shimmer: 'shimmer 1.6s linear infinite',
        drift: 'drift 7s ease-in-out infinite',
        marquee: 'marquee 40s linear infinite',
        'dialog-in': 'dialog-in 220ms cubic-bezier(0.22, 1, 0.36, 1)',
      },
    },
  },
  plugins: [],
} satisfies Config;
