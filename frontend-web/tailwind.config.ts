import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        primary: '#7c6af7',
        success: '#4fd9a0',
        warning: '#f5c842',
        error: '#f05a5a',
        surface: '#111118',
        surface2: '#17171f',
      },
    },
  },
  plugins: [],
}
export default config
