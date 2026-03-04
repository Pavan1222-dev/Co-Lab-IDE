/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  theme: {
    extend: {
      colors: {
        obsidian: '#0D1117',
        slate: '#161B22',
        cobalt: '#3B82F6',
        emerald: '#10B981',
        hacker: '#00FF41',
      },
      fontFamily: {
        mono: ['"Fira Code"', 'monospace'],
      },
    },
  },
  plugins: [],
}