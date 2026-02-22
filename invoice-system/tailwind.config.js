/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
    './app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'gs-navy': '#0a0a14',
        'gs-dark': '#12121f',
        'gs-blue': '#00b4d8',
        'gs-blue-light': '#48cae4',
        'gs-silver': '#c0c0c0',
        'gs-silver-light': '#e8e8e8',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
