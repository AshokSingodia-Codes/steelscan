/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Bebas Neue"', 'cursive'],
        mono: ['"JetBrains Mono"', 'monospace'],
        body: ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        industrial: {
          50: '#F4F5F7',
          200: '#B4B9C0',
          400: '#6B7280',
          600: '#3A414A',
          700: '#262B31',
          800: '#1C2025',
          900: '#14171B',
          950: '#0B0D10',
        },
        brass: {
          400: '#D8BE8C',
          500: '#C2A46B',
        },
        copper: {
          500: '#B87333',
        },
        scan: {
          cyan: '#35D6E8',
        },
        molten: {
          amber: '#F59E0B',
        },
        signal: {
          green: '#3DDC97',
        },
        alert: {
          red: '#EF4444',
        },
        // Fallbacks/Legacy aliases to avoid breaking if not updated immediately
        primary: {
          DEFAULT: '#C2A46B',
          hover: '#D8BE8C',
        },
        accent: {
          DEFAULT: '#F59E0B',
          hover: '#D97706',
        },
        success: '#3DDC97',
        warning: '#F59E0B',
        error: '#EF4444'
      },
      backgroundImage: {
        'confidence-gradient': 'linear-gradient(to right, #EF4444, #F59E0B, #3DDC97)',
      },
      animation: {
        'slide-up': 'slideUp 0.4s ease-out',
        'fade-in': 'fadeIn 0.3s ease-out',
        'pulse-cyan': 'pulseCyan 2s cubic-bezier(0.4, 0, 0.6, 1) infinite',
      },
      keyframes: {
        slideUp: {
          '0%': { transform: 'translateY(20px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseCyan: {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.6' },
        }
      },
      boxShadow: {
        'card': '0 8px 32px rgba(0, 0, 0, 0.45)',
        'floating': '0 10px 15px -3px rgba(0, 0, 0, 0.45), 0 4px 6px -2px rgba(0, 0, 0, 0.3)',
        'focus-ring': '0 0 0 3px rgba(194, 164, 107, 0.4)',
        'cyan-glow': '0 0 12px rgba(53, 214, 232, 0.25)',
      },
    },
  },
  plugins: [],
}
