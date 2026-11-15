/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        ink:    '#0b1016',   // page background
        panel:  '#131b25',   // cards, sheets
        raised: '#1c2735',   // hover / inputs
        line:   '#293647',   // borders
        fg:     '#e9eef5',   // primary text
        muted:  '#94a3b8',   // secondary text
        dim:    '#64748b',   // tertiary text
        accent: {
          DEFAULT: '#f5b83d',  // amber — actions, progress, "watching"
          deep:    '#d99a1c',
          ink:     '#1c1403',  // text on accent
        },
        seen:   '#3ddc97',   // green — "watched", fresh scores
        rotten: '#f0635c',   // red — low scores, destructive
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
