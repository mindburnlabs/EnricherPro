/** @type {import('tailwindcss').Config} */
module.exports = {
  darkMode: 'class',
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: 'hsl(var(--bg-primary) / <alpha-value>)',
        surface: 'hsl(var(--bg-secondary) / <alpha-value>)',
        card: 'hsl(var(--bg-card) / <alpha-value>)',

        primary: {
          DEFAULT: 'hsl(var(--text-primary) / <alpha-value>)',
          subtle: 'hsl(var(--text-secondary) / <alpha-value>)',
          accent: 'hsl(var(--text-accent) / <alpha-value>)',
        },

        border: {
          subtle: 'hsl(var(--border-subtle) / <alpha-value>)',
          highlight: 'hsl(var(--border-highlight) / <alpha-value>)',
        },

        status: {
          success: 'hsl(var(--color-success) / <alpha-value>)',
          warning: 'hsl(var(--color-warning) / <alpha-value>)',
          error: 'hsl(var(--color-error) / <alpha-value>)',
          info: 'hsl(var(--color-info) / <alpha-value>)',
        }
      }
    },
  },
  plugins: [],
}