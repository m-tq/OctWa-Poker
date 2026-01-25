/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        background: 'var(--color-background)',
        foreground: 'var(--color-foreground)',
        card: 'var(--color-card)',
        border: 'var(--color-border)',
        primary: 'var(--color-primary)',
        'primary-foreground': 'var(--color-primary-foreground)',
        secondary: 'var(--color-secondary)',
        muted: 'var(--color-muted)',
        destructive: '#dc2626',
        success: '#16a34a',
        warning: '#ca8a04',
      },
      fontFamily: {
        mono: ['Fira Code', 'monospace'],
      },
      borderRadius: {
        none: '0',
      },
      animation: {
        'card-deal': 'cardDeal 0.3s ease-out',
        'chip-move': 'chipMove 0.5s ease-out',
        'pulse-slow': 'pulse 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        cardDeal: {
          '0%': { transform: 'translateY(-100px) rotate(-10deg)', opacity: '0' },
          '100%': { transform: 'translateY(0) rotate(0)', opacity: '1' },
        },
        chipMove: {
          '0%': { transform: 'scale(0.5)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
      },
    },
  },
  plugins: [],
};
