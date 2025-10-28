/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
    "./public/index.html"
  ],
  safelist: [
    'bg-red-500',
    'text-white',
    'p-4',
    'm-4',
    'rounded-lg',
    'text-2xl',
    'font-bold',
    'text-sm'
  ],
  theme: {
    extend: {
      fontFamily: {
        'inter': ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
}