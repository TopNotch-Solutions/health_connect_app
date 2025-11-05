// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",     // <-- ADD THIS
    "./components/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        'primary': '#007BFF',
        'secondary': '#28A745',
        'text-main': '#6C757D',
        'background-light': '#E9F7EF',
        'white': '#FFFFFF',
      },
    },
  },
  plugins: [],
};
