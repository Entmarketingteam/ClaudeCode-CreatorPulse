/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Primary brand colors
        primary: {
          50: '#f0f9ff',
          100: '#e0f2fe',
          200: '#bae6fd',
          300: '#7dd3fc',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          700: '#0369a1',
          800: '#075985',
          900: '#0c4a6e',
        },
        // Accent colors for platforms
        amazon: '#FF9900',
        ltk: '#F472B6',
        shopmy: '#8B5CF6',
        mavely: '#10B981',
        // Status colors
        success: '#22C55E',
        warning: '#F59E0B',
        error: '#EF4444',
        // Dark theme
        dark: {
          bg: '#0A0A0A',
          card: '#141414',
          border: '#262626',
          text: '#FAFAFA',
          muted: '#A1A1AA',
        },
      },
      fontFamily: {
        sans: ['Satoshi', 'General Sans', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      fontSize: {
        'currency': ['1.5rem', { fontVariantNumeric: 'tabular-nums' }],
      },
      animation: {
        'shimmer': 'shimmer 2s linear infinite',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        shimmer: {
          '0%': { transform: 'translateX(-100%)' },
          '100%': { transform: 'translateX(100%)' },
        },
      },
    },
  },
  plugins: [],
};
