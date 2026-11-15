/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // One hue throughout: every colour is a shade of the primary, #A1B5D8.
        ink:    '#0d121b',   // page background
        panel:  '#151c2a',   // cards, sheets
        raised: '#1f2839',   // hover / inputs
        line:   '#2e3a52',   // borders
        fg:     '#e9eef8',   // primary text
        muted:  '#96a6c4',   // secondary text
        dim:    '#6b7b9c',   // tertiary text
        accent: {
          DEFAULT: '#a1b5d8',  // primary — actions, progress, "watching"
          deep:    '#8a9fc6',  // hover
          ink:     '#0f1626',  // text on primary
        },
        seen:   '#dbe5f5',   // palest tint — "watched", high scores
        rotten: '#f0635c',   // the one exception: errors and delete actions only
      },
      fontFamily: {
        // Arial only (Helvetica / system sans where Arial is not installed)
        sans: ['Arial', 'Helvetica', 'sans-serif'],
      },
      maxWidth: {
        page: '1600px',
      },
    },
  },
  plugins: [],
}
