import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: '#080810',
        surface: '#0d0d1a',
        border: '#1e2040',
        accent: '#4fc3f7',
        green: '#00ff9d',
        purple: '#c084fc',
        amber: '#ffb347',
        danger: '#ef4444',
      },
      fontFamily: {
        mono: ['"Courier New"', 'Courier', 'monospace'],
      },
    },
  },
  plugins: [],
};

export default config;
