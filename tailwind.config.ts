import type { Config } from 'tailwindcss'

export default {
  content: [
    './app/components/**/*.{vue,js,ts}',
    './app/layouts/**/*.{vue,js,ts}',
    './app/pages/**/*.{vue,js,ts}',
    './app/plugins/**/*.{js,ts}',
    './app/**/*.vue',
    './nuxt.config.ts'
  ],
  theme: {
    extend: {}
  },
  plugins: []
} satisfies Config
