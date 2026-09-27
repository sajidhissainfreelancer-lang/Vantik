/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: 'rgb(var(--c-ink) / <alpha-value>)',
          2: 'rgb(var(--c-ink-2) / <alpha-value>)',
          3: 'rgb(var(--c-ink-3) / <alpha-value>)',
        },
        line: 'rgb(var(--c-line) / <alpha-value>)',
        signal: {
          DEFAULT: 'rgb(var(--c-signal) / <alpha-value>)',
          bright: 'rgb(var(--c-signal-bright) / <alpha-value>)',
        },
        volt: 'rgb(var(--c-volt) / <alpha-value>)',
        'on-signal': 'rgb(var(--c-on-signal) / <alpha-value>)',
        text: {
          DEFAULT: 'rgb(var(--c-text) / <alpha-value>)',
          muted: 'rgb(var(--c-text-muted) / <alpha-value>)',
        },
      },
      fontFamily: {
        display: ['var(--font-display)', '"Space Grotesk"', 'sans-serif'],
        body: ['var(--font-body)', '"Inter"', 'sans-serif'],
      },
      borderRadius: {
        card: 'var(--radius-card, 0.75rem)',
      },
      boxShadow: {
        card: 'var(--shadow-card, none)',
      },
      backgroundImage: {
        'grid-fade': 'linear-gradient(to bottom, rgb(var(--c-ink) / 0) 0%, rgb(var(--c-ink)) 85%)',
      },
    },
  },
  plugins: [],
}
