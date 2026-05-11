/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx}",
    "./components/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {colors: {
    /* 🎨 brand */
    primary: 'rgb(var(--color-primary) / <alpha-value>)',

    /* 🧾 text */
    text: 'rgb(var(--color-text) / <alpha-value>)',
    muted: 'rgb(var(--color-text-muted) / <alpha-value>)',

    /* 🧱 surfaces */
    surface: 'rgb(var(--color-surface) / <alpha-value>)',
    'surface-muted': 'rgb(var(--color-surface-muted) / <alpha-value>)',

    /* 🚨 states */
    danger: 'rgb(var(--color-danger) / <alpha-value>)',
    success: 'rgb(var(--color-success) / <alpha-value>)',
  },},
  },
  plugins: [require("daisyui")],
};