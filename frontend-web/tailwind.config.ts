import type { Config } from 'tailwindcss'

const config: Config = {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#ecfdf5',
          100: '#d1fae5',
          500: '#10b981',
          600: '#059669',
          700: '#047857',
          900: '#064e3b',
        },
        ink: '#0b1b2b',
      },
      boxShadow: {
        soft: '0 8px 24px rgba(11,27,43,0.06)',
      },
    },
  },
  plugins: [],
}
export default config
