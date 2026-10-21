/** @type {import('tailwindcss').Config} */
const ramp = (name) => Object.fromEntries([100, 200, 300, 400, 500, 600, 700, 800, 900].map(s => [s, `var(--color-${name}-${s})`]))

export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    borderRadius: { none: '0', DEFAULT: '0', sm: '0', md: '0', lg: '0', xl: '0', '2xl': '0', '3xl': '0', full: '0' },
    extend: {
      colors: {
        ground: 'var(--color-bg)',
        surface: 'var(--color-surface)',
        ink: 'var(--color-text)',
        divider: 'var(--color-divider)',
        accent: { DEFAULT: 'var(--color-accent)', ...ramp('accent') },
        neutral: ramp('neutral'),
        musician: 'var(--color-accent)',
        craigslist: 'var(--color-text)',
      },
      fontFamily: { sans: ['Archivo', 'system-ui', 'sans-serif'] },
      boxShadow: { sm: 'var(--shadow-sm)', md: 'var(--shadow-md)', lg: 'var(--shadow-lg)' },
      borderWidth: { DEFAULT: '2px' },
    },
  },
  plugins: [],
}
