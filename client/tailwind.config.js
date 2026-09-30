/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        brand: {
          50: 'rgb(var(--color-brand-50) / <alpha-value>)',
          100: 'rgb(var(--color-brand-100) / <alpha-value>)',
          200: 'rgb(var(--color-brand-200) / <alpha-value>)',
          300: 'rgb(var(--color-brand-300) / <alpha-value>)',
          400: 'rgb(var(--color-brand-400) / <alpha-value>)',
          500: 'rgb(var(--color-brand-500) / <alpha-value>)',
          600: 'rgb(var(--color-brand-600) / <alpha-value>)',
          700: 'rgb(var(--color-brand-700) / <alpha-value>)',
          800: 'rgb(var(--color-brand-800) / <alpha-value>)',
          900: 'rgb(var(--color-brand-900) / <alpha-value>)',
          950: 'rgb(var(--color-brand-950) / <alpha-value>)',
        },
        accent: {
          50: '#fff7ed',
          100: '#ffedd5',
          200: '#fed7aa',
          300: '#fdba74',
          400: '#fb923c',
          500: '#f97316',
          600: '#ea580c',
          700: '#c2410c',
          800: '#9a3412',
          900: '#7c2d12',
        },
        background: 'rgb(var(--color-background, 255 255 255) / <alpha-value>)',
        foreground: 'rgb(var(--color-foreground, 15 23 42) / <alpha-value>)',
        card: {
          DEFAULT: 'rgb(var(--color-card, 255 255 255) / <alpha-value>)',
          foreground: 'rgb(var(--color-card-foreground, 15 23 42) / <alpha-value>)',
        },
        muted: {
          DEFAULT: 'rgb(var(--color-muted, 241 245 249) / <alpha-value>)',
          foreground: 'rgb(var(--color-muted-foreground, 100 116 139) / <alpha-value>)',
        },
        border: 'rgb(var(--color-border, 226 232 240) / <alpha-value>)',
        primary: {
          DEFAULT: 'rgb(var(--color-brand-600, 79 70 229) / <alpha-value>)',
          foreground: '#ffffff',
        },
        destructive: {
          DEFAULT: '#ef4444',
          foreground: '#ffffff',
        }
      },
      fontFamily: {
        brand: ['Inter', '"IBM Plex Sans Arabic"', 'sans-serif'],
        sans: ['Inter', '"IBM Plex Sans Arabic"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        ruqaa: ['"Aref Ruqaa"', 'serif'],
        'square-peg': ['"Square Peg"', 'cursive'],
        playpen: ['"Playpen Sans Arabic"', 'sans-serif'],
      }
    },
  },
  plugins: [],
}
