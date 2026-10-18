import type { Config } from 'tailwindcss'

const c = (name: string) => `hsl(var(--${name}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./app/**/*.{ts,tsx}', './components/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"Inter Variable"', '"Noto Naskh Arabic Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        display: ['"Inter Variable"', '"Noto Naskh Arabic Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono Variable"', 'ui-monospace', 'monospace'],
      },
      colors: {
        background: c('background'),
        foreground: c('foreground'),
        card: c('card'),
        muted: { DEFAULT: c('muted'), foreground: c('muted-foreground') },
        border: c('border'),
        primary: { DEFAULT: c('primary'), foreground: c('primary-foreground'), soft: c('primary-soft') },
        accent: { DEFAULT: c('accent'), foreground: c('accent-foreground') },
        danger: c('danger'),
        ring: c('ring'),
      },
      borderRadius: { lg: '0.75rem', xl: '1rem', '2xl': '1.375rem' },
      boxShadow: {
        card: '0 1px 0 hsl(var(--border) / 0.6), 0 12px 32px -16px hsl(var(--foreground) / 0.18)',
        pop: '0 24px 60px -24px hsl(var(--primary) / 0.45)',
      },
      keyframes: {
        'chart-in': { from: { opacity: '0', transform: 'translateY(10px) scale(0.985)' }, to: { opacity: '1', transform: 'none' } },
        'rise': { from: { opacity: '0', transform: 'translateY(8px)' }, to: { opacity: '1', transform: 'none' } },
        'grow-x': { from: { transform: 'scaleX(0)' }, to: { transform: 'scaleX(1)' } },
        'pulse-ring': { '0%': { boxShadow: '0 0 0 0 hsl(var(--danger) / 0.5)' }, '100%': { boxShadow: '0 0 0 14px hsl(var(--danger) / 0)' } },
        'shimmer': { from: { backgroundPosition: '200% 0' }, to: { backgroundPosition: '-200% 0' } },
      },
      animation: {
        rise: 'rise 0.35s ease-out both',
        'chart-in': 'chart-in 0.5s cubic-bezier(.2,.8,.2,1) both',
        'pulse-ring': 'pulse-ring 1.2s ease-out infinite',
        shimmer: 'shimmer 2.2s linear infinite',
      },
    },
  },
  plugins: [],
} satisfies Config
