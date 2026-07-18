/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./hubs/album/index.html",
    "./hubs/**/*.html",
    "./*.html",
  ],
  darkMode: ["selector", '[data-theme="dark"]'],
  theme: {
    extend: {
      colors: {
        // Light theme
        dark: '#0a0a0f',
        card: '#12121a',
        accent: '#6366f1',
        glow: '#818cf8',
        surf: '#1a1a24',
        // Dark theme palette (畫圖大師)
        warmblack: '#14110d',
        vermilion: '#ff6b3d',
        moss: '#4fb3a8',
      },
      fontFamily: {
        sans: ['Inter', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
