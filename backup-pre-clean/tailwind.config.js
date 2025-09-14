/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{html,ts}"
  ],
  theme: {
    extend: {
      colors: { brand: { 600: "#16a34a", 900: "#052e16", 800: "#064e3b", 500: "#22c55e", 400: "#34d399" } }
    }
  },
  plugins: []
};
