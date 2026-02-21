/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          DEFAULT: '#E50914',
          dark: '#b20710',
        },
        dark: {
          DEFAULT: '#141414',
          lighter: '#2a2a2a',
          card: '#1f1f1f',
        },
      },
      fontFamily: {
        logo: ['Bebas Neue', 'sans-serif'],
        heading: ['DM Sans', 'sans-serif'],
        sans: ['DM Sans', 'sans-serif'],
      },
      fontSize: {
        'hero': ['3.5rem', { lineHeight: '1.1', fontWeight: '700' }],
        'row-title': ['1.1rem', { lineHeight: '1.4', fontWeight: '600' }],
      },
      transitionDuration: {
        '150': '150ms',
        '200': '200ms',
      },
    },
  },
  plugins: [],
}
