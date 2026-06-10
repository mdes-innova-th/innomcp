import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // MDES brand
        'mdes': {
          primary: '#1a3c6e',
          'primary-light': '#2d5a9e',
          accent: '#c8973e',
          'accent-light': '#e8b85e',
        },
        // Thai government
        'thai-red': '#C00000',
        'thai-blue': '#003087',
      },
      fontFamily: {
        'thai': ['Noto Sans Thai', 'Sarabun', 'sans-serif'],
        'display': ['Noto Sans Thai', 'Inter', 'sans-serif'],
      },
      animation: {
        'mdes-shimmer': 'mdes-shimmer 2s linear infinite',
        'float-orbit': 'float-orbit 8s ease-in-out infinite',
        'manus-slide-in': 'manus-slide-in 0.25s ease-out',
        'agent-pulse': 'agent-pulse 1.5s ease-in-out infinite',
      },
      keyframes: {
        'mdes-shimmer': {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        'float-orbit': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '50%': { transform: 'translate(10px, -15px) rotate(180deg)' },
        },
        'manus-slide-in': {
          from: { transform: 'translateX(100%)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
        'agent-pulse': {
          '0%, 100%': { opacity: '1', transform: 'scale(1)' },
          '50%': { opacity: '0.6', transform: 'scale(1.05)' },
        },
      },
      spacing: {
        '18': '4.5rem',
        '88': '22rem',
        '128': '32rem',
      },
      maxWidth: {
        '8xl': '88rem',
        '9xl': '96rem',
      },
      backdropBlur: {
        xs: '2px',
      },
    },
  },
  plugins: [],
};

export default config;