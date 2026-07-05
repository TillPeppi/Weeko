/**
 * Color coding per block type (requirements §6.3) for light + dark mode.
 * "Neo Brutal": blocks are full saturated surfaces with ink borders and ink
 * text — the same in both modes. Tailwind classes for styled components,
 * hex values for places that need raw colors (chips, icons, stats).
 */
import type { BlockType } from '@/domain/types';

export interface BlockPalette {
  /** solid accent, e.g. chips/dots on light surfaces */
  hex: string;
  hexDark: string;
  /** nativewind classes for full-color block surfaces */
  bgClass: string;
  borderClass: string;
  textClass: string;
}

const INK_BORDER = 'border-border dark:border-border-dark';
/** ink-on-color: always dark, regardless of theme (surfaces stay saturated) */
const INK_TEXT = 'text-ink';

export const BLOCK_COLORS: Record<BlockType, BlockPalette> = {
  work: {
    hex: '#4a90e2',
    hexDark: '#6aa6ec',
    bgClass: 'bg-block-work',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  handball: {
    hex: '#efa73f',
    hexDark: '#f4b95f',
    bgClass: 'bg-block-handball',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  training: {
    hex: '#e87356',
    hexDark: '#ef8a70',
    bgClass: 'bg-block-training',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  dog: {
    hex: '#7fd39a',
    hexDark: '#93dfaa',
    bgClass: 'bg-block-dog',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  meal: {
    hex: '#bcd85e',
    hexDark: '#c9e26e',
    bgClass: 'bg-block-meal',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  hobby: {
    hex: '#a98cea',
    hexDark: '#bba2f0',
    bgClass: 'bg-block-hobby',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  task: {
    hex: '#5bcbd8',
    hexDark: '#74d6e1',
    bgClass: 'bg-block-task',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
  free: {
    hex: '#cdc6b5',
    hexDark: '#d8d2c2',
    bgClass: 'bg-block-free',
    borderClass: INK_BORDER,
    textClass: INK_TEXT,
  },
};
