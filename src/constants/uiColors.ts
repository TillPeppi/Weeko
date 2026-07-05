/**
 * Raw hex values for places that can't use className strings (lucide icons,
 * spinners, tab bar). Mirrors the palette in tailwind.config.js — keep in sync.
 */
import type { ViewStyle } from 'react-native';

export const UI_COLORS = {
  muted: { light: '#6d6759', dark: '#a49d8e' },
  accent: { light: '#3d7fd6', dark: '#5b9df0' },
  danger: { light: '#d94f2b', dark: '#ef7352' },
  warning: { light: '#c07f16', dark: '#f0a832' },
  success: { light: '#2e9e5b', dark: '#7fd898' },
  ink: { light: '#141519', dark: '#f1ecdf' },
  highlight: { light: '#f6c445', dark: '#f6c445' },
} as const;

export function uiColor(name: keyof typeof UI_COLORS, dark: boolean): string {
  return dark ? UI_COLORS[name].dark : UI_COLORS[name].light;
}

/**
 * Hard offset shadow — the "Neo Brutal" signature. Light mode only; dark mode
 * stays flat (paper-colored borders carry the look there).
 */
export function neoShadow(dark: boolean, offset: 2 | 3 | 4 = 3): ViewStyle | undefined {
  return dark ? undefined : { boxShadow: `${offset}px ${offset}px 0 0 #141519` };
}
