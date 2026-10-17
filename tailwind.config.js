const c = (v) => `rgb(var(--c-${v}) / <alpha-value>)`;
/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        app: c('app'), panel: c('panel'), panel2: c('panel2'), line: c('line'),
        ink: c('ink'), mute: c('mute'), buy: c('buy'), sell: c('sell'),
        gain: c('gain'), loss: c('loss'), warn: c('warn'),
      },
      fontFamily: {
        sans: ['"IBM Plex Sans"', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      keyframes: {
        up: { '0%': { backgroundColor: 'rgb(var(--c-gain) / .35)' }, '100%': { backgroundColor: 'transparent' } },
        down: { '0%': { backgroundColor: 'rgb(var(--c-loss) / .35)' }, '100%': { backgroundColor: 'transparent' } },
        slide: { '0%': { transform: 'translateY(12px)', opacity: 0 }, '100%': { transform: 'none', opacity: 1 } },
      },
      animation: { up: 'up .7s ease-out', down: 'down .7s ease-out', slide: 'slide .18s ease-out' },
    },
  },
  plugins: [],
};
