import type { Config } from 'tailwindcss';

export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        paper: '#F6F3EC',
        surface: '#FFFFFF',
        ink: '#16191D',
        muted: '#5C636B',
        line: '#DDD8CC',
        accent: { DEFAULT: '#1F4D3F', dark: '#163A2F', soft: '#E3EDE8' },
        lost: { DEFAULT: '#A63D2A', soft: '#F6E6E1' },
      },
      fontFamily: {
        serif: ['Newsreader', 'Georgia', 'serif'],
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
      maxWidth: { page: '72rem' },
    },
  },
  plugins: [],
} satisfies Config;
