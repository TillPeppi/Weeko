import { describe, expect, it } from 'vitest';
import {
  blockProgress,
  currentBlock,
  minutesRemaining,
  nextBlock,
  splitHm,
} from './dayProgress';

const blocks = [
  { start: '07:30', end: '17:00', title: 'work' },
  { start: '18:30', end: '20:30', title: 'handball' },
];

describe('currentBlock / nextBlock', () => {
  it('finds the block containing now', () => {
    expect(currentBlock(blocks, '10:00')?.title).toBe('work');
    expect(currentBlock(blocks, '17:30')).toBeUndefined();
  });
  it('finds the next block at or after now', () => {
    expect(nextBlock(blocks, '17:30')?.title).toBe('handball');
    expect(nextBlock(blocks, '21:00')).toBeUndefined();
  });
});

describe('blockProgress', () => {
  it('is 0 at start, ~0.5 at midpoint, clamps to 1 after end', () => {
    expect(blockProgress('10:00', '12:00', '10:00')).toBe(0);
    expect(blockProgress('10:00', '12:00', '11:00')).toBeCloseTo(0.5);
    expect(blockProgress('10:00', '12:00', '13:00')).toBe(1);
    expect(blockProgress('10:00', '12:00', '09:00')).toBe(0);
  });
  it('returns 0 for degenerate intervals', () => {
    expect(blockProgress('10:00', '10:00', '10:00')).toBe(0);
  });
});

describe('minutesRemaining / splitHm', () => {
  it('counts minutes to end, never negative', () => {
    expect(minutesRemaining('17:00', '10:52')).toBe(368);
    expect(minutesRemaining('10:00', '12:00')).toBe(0);
  });
  it('splits into hours and minutes', () => {
    expect(splitHm(368)).toEqual({ hours: 6, minutes: 8 });
    expect(splitHm(45)).toEqual({ hours: 0, minutes: 45 });
  });
});
