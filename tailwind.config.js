/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'media',
  content: ['./src/renderer/index.html', './src/renderer/**/*.{ts,tsx}'],
  theme: {
    extend: {
      fontFamily: {
        sans: ['-apple-system', 'BlinkMacSystemFont', '"SF Pro Text"', 'sans-serif'],
        mono: ['"SF Mono"', 'ui-monospace', 'Menlo', 'monospace']
      },
      colors: {
        glass: 'rgb(var(--color-glass) / <alpha-value>)',
        border: 'rgb(var(--color-border) / <alpha-value>)',
        fg: 'rgb(var(--color-fg) / <alpha-value>)',
        accent: 'rgb(var(--color-accent) / <alpha-value>)',
        kill: 'rgb(var(--color-kill) / <alpha-value>)',
        success: 'rgb(var(--color-success) / <alpha-value>)',
        warning: 'rgb(var(--color-warning) / <alpha-value>)'
      },
      borderRadius: {
        row: '11px'
      }
    }
  },
  plugins: []
};
