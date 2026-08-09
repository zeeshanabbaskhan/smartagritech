/** Tailwind color that reads a CSS custom property and supports /opacity modifiers. */
function cssVarColor(variable, fallback) {
  return ({ opacityValue }) => {
    const color = `var(${variable}, ${fallback})`
    if (opacityValue === undefined) return color
    return `color-mix(in srgb, ${color} ${Number(opacityValue) * 100}%, transparent)`
  }
}

export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
        mono: ['JetBrains Mono', 'monospace'],
      },
      colors: {
        // Space-separated RGB channels in --color-primary-* (see ThemeContext / :root)
        // so Tailwind /opacity modifiers work (bg-primary-500/20).
        primary: {
          50:  'rgb(var(--color-primary-50) / <alpha-value>)',
          100: 'rgb(var(--color-primary-100) / <alpha-value>)',
          200: 'rgb(var(--color-primary-200) / <alpha-value>)',
          300: 'rgb(var(--color-primary-300) / <alpha-value>)',
          400: 'rgb(var(--color-primary-400) / <alpha-value>)',
          500: 'rgb(var(--color-primary-500) / <alpha-value>)',
          600: 'rgb(var(--color-primary-600) / <alpha-value>)',
          700: 'rgb(var(--color-primary-700) / <alpha-value>)',
          800: 'rgb(var(--color-primary-800) / <alpha-value>)',
          900: 'rgb(var(--color-primary-900) / <alpha-value>)',
        },
        surface: {
          50:  '#FEFEF8',   // ← lemon-white page background
          100: '#F7F7EE',   // ← very soft lemon for alternates
          200: '#ECEEE6',
          300: '#D1D5C8',
          400: '#9AA09A',
          500: '#6B7280',
          600: '#4B5563',
          700: '#374151',
          800: '#1F2937',
          900: '#141828',   // sidebar / dark card
          950: '#0A0D14',   // deepest dark
        },
        success: { 100: '#DCFCE7', 600: '#16A34A', 700: '#15803D' },
        // Semantic warning stays fixed amber (not brand-tied)
        warning: { 100: '#FEF3C7', 600: '#F5A623', 700: '#E8941A' },
        danger:  { 100: '#FEE2E2', 600: '#DC2626', 700: '#B91C1C' },
        info:    { 100: '#DBEAFE', 600: '#2563EB', 700: '#1D4ED8' },
      },
    },
  },
  plugins: [],
}
