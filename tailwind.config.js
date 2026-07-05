/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  presets: [require('nativewind/preset')],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // App surfaces — "Neo Brutal" direction: warm paper, ink borders,
        // saturated block colors. Dark mode inverts paper/ink.
        surface: { DEFAULT: '#f1ebde', dark: '#15161b' },
        card: { DEFAULT: '#fdfaf2', dark: '#20222a' },
        // pure white pop surface for highlighted cards ("now" cockpit card etc.)
        elevated: { DEFAULT: '#ffffff', dark: '#272b35' },
        // borders are ink-colored (paper-colored in dark) — the defining trait
        border: { DEFAULT: '#141519', dark: '#e8e2d3' },
        // neutral fill for progress-bar tracks and hairline grid lines
        track: { DEFAULT: '#e3dcc9', dark: '#2c2f3a' },
        ink: { DEFAULT: '#141519', dark: '#f1ecdf', muted: '#6d6759', 'muted-dark': '#a49d8e' },
        accent: { DEFAULT: '#3d7fd6', dark: '#5b9df0' },
        // yellow chip/CTA color (time badge, primary buttons, active pills)
        highlight: { DEFAULT: '#f6c445', dark: '#f6c445' },
        danger: { DEFAULT: '#d94f2b', dark: '#ef7352' },
        warning: { DEFAULT: '#c07f16', dark: '#f0a832' },
        success: { DEFAULT: '#2e9e5b', dark: '#7fd898' },
        // Block type colors (full card surfaces; light/dark pairs in src/constants/blockColors.ts)
        'block-work': '#4a90e2',
        'block-handball': '#efa73f',
        'block-training': '#e87356',
        'block-dog': '#7fd39a',
        'block-meal': '#bcd85e',
        'block-hobby': '#a98cea',
        'block-task': '#5bcbd8',
        'block-free': '#cdc6b5',
      },
    },
  },
};
