import type { Config } from 'tailwindcss';
export default {
  content: ['./src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        star: { DEFAULT: '#F59E0B', deep: '#B45309', soft: '#FEF3C7' },
        ink: '#1F2937',
      },
    },
  },
  plugins: [],
} satisfies Config;
