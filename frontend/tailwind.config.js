/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        parchment: {
          50:  '#faf6f0',
          100: '#f2e8d5',
          200: '#e5d0aa',
          300: '#d4b07a',
          400: '#c49a5c',
          500: '#b8864a',
          600: '#a06d3a',
          700: '#7d5230',
          800: '#65422b',
          900: '#543725',
        },
        academia: {
          50:  '#f0ebe3',
          100: '#d4c9b5',
          200: '#b8a787',
          300: '#9c8559',
          400: '#80703d',
          500: '#6b5c32',
          600: '#564a28',
          700: '#41381e',
          800: '#2c2614',
          900: '#1a160c',
        },
      },
      fontFamily: {
        serif: ['"Noto Serif SC"', '"Source Han Serif SC"', 'Georgia', 'serif'],
        sans: ['"Noto Sans SC"', '"Source Han Sans SC"', 'system-ui', 'sans-serif'],
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-soft': 'pulseSoft 2s ease-in-out infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseSoft: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.7' },
        },
      },
    },
  },
  plugins: [],
}
