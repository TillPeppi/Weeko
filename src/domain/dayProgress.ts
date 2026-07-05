/**
 * Helpers for the Today view: current/next block by wall-clock time.
 * Pure functions — callers pass "now" explicitly.
 */
import { isWithin, toMinutes } from './time';

export interface TimedBlock {
  start: string;
  end: string;
}

/** The block whose [start, end) interval contains `nowTime` (HH:mm). */
export function currentBlock<T extends TimedBlock>(blocks: T[], nowTime: string): T | undefined {
  return blocks.find((b) => isWithin(nowTime, b.start, b.end));
}

/** The next block starting at or after `nowTime`, earliest first. */
export function nextBlock<T extends TimedBlock>(blocks: T[], nowTime: string): T | undefined {
  const now = toMinutes(nowTime);
  return [...blocks]
    .filter((b) => toMinutes(b.start) >= now)
    .sort((a, b) => toMinutes(a.start) - toMinutes(b.start))[0];
}

export function sortBlocksByStart<T extends TimedBlock>(blocks: T[]): T[] {
  return [...blocks].sort((a, b) => toMinutes(a.start) - toMinutes(b.start));
}

/** Fraction 0..1 of how far `nowTime` is through [start, end). Clamped. */
export function blockProgress(start: string, end: string, nowTime: string): number {
  const s = toMinutes(start);
  const e = toMinutes(end);
  if (e <= s) return 0;
  return Math.min(1, Math.max(0, (toMinutes(nowTime) - s) / (e - s)));
}

/** Whole minutes left until `end` from `nowTime` (never negative). */
export function minutesRemaining(end: string, nowTime: string): number {
  return Math.max(0, toMinutes(end) - toMinutes(nowTime));
}

/** Splits a minute count into { hours, minutes } for display. */
export function splitHm(totalMinutes: number): { hours: number; minutes: number } {
  return { hours: Math.floor(totalMinutes / 60), minutes: totalMinutes % 60 };
}
