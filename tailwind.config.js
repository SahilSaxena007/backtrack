/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/renderer/**/*.{js,ts,jsx,tsx}',
    './src/renderer/index.html',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          primary: '#2563eb',
          accent: '#10b981',
          bgLight: '#f8fafc',
          bgDark: '#0f172a',
        },
      },
    },
  },
  plugins: [],
};
