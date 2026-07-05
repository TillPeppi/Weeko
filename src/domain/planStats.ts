/**
 * Plan statistics across weeks: adherence trend (done/skipped/open per week),
 * per-type time budget & skip rates, weekday reliability and task completion
 * per category. Framework-free.
 */
import { durationMinutes, isoWeekday } from './time';
import type { BlockStatus, BlockType } from './types';

export interface PlanBlock {
  /** YYYY-MM-DD */
  date: string;
  type: BlockType;
  status: BlockStatus;
  start: string;
  end: string;
}

export interface WeekPlan {
  year: number;
  isoWeek: number;
  blocks: PlanBlock[];
}

export interface WeekAdherencePoint {
  year: number;
  isoWeek: number;
  total: number;
  done: number;
  skipped: number;
  open: number;
  /** done / total (0 when the week has no blocks) */
  donePercent: number;
}

/** Adherence per week, sorted oldest → newest. */
export function weeklyAdherence(weeks: WeekPlan[]): WeekAdherencePoint[] {
  return [...weeks]
    .sort((a, b) => a.year - b.year || a.isoWeek - b.isoWeek)
    .map((week) => {
      const total = week.blocks.length;
      const done = week.blocks.filter((b) => b.status === 'done').length;
      const skipped = week.blocks.filter((b) => b.status === 'skipped').length;
      return {
        year: week.year,
        isoWeek: week.isoWeek,
        total,
        done,
        skipped,
        open: total - done - skipped,
        donePercent: total > 0 ? Math.round((done / total) * 100) : 0,
      };
    });
}

export interface TypeStat {
  type: BlockType;
  total: number;
  done: number;
  skipped: number;
  /** skipped / total */
  skippedPercent: number;
  plannedMinutes: number;
  doneMinutes: number;
}

/** Per-type counts and time budget, sorted by planned minutes (desc). */
export function typeStats(blocks: PlanBlock[]): TypeStat[] {
  const byType = new Map<BlockType, TypeStat>();
  for (const block of blocks) {
    const stat =
      byType.get(block.type) ??
      ({
        type: block.type,
        total: 0,
        done: 0,
        skipped: 0,
        skippedPercent: 0,
        plannedMinutes: 0,
        doneMinutes: 0,
      } satisfies TypeStat);
    const minutes = durationMinutes(block.start, block.end);
    stat.total += 1;
    stat.plannedMinutes += minutes;
    if (block.status === 'done') {
      stat.done += 1;
      stat.doneMinutes += minutes;
    } else if (block.status === 'skipped') {
      stat.skipped += 1;
    }
    byType.set(block.type, stat);
  }
  return [...byType.values()]
    .map((stat) => ({
      ...stat,
      skippedPercent: stat.total > 0 ? Math.round((stat.skipped / stat.total) * 100) : 0,
    }))
    .sort((a, b) => b.plannedMinutes - a.plannedMinutes);
}

export interface WeekdayStat {
  /** ISO weekday 1–7 */
  weekday: number;
  total: number;
  skipped: number;
  skippedPercent: number;
}

/** Which weekday tips over most often? Only weekdays with blocks are returned. */
export function weekdayStats(blocks: PlanBlock[]): WeekdayStat[] {
  const byDay = new Map<number, { total: number; skipped: number }>();
  for (const block of blocks) {
    const weekday = isoWeekday(block.date);
    const stat = byDay.get(weekday) ?? { total: 0, skipped: 0 };
    stat.total += 1;
    if (block.status === 'skipped') stat.skipped += 1;
    byDay.set(weekday, stat);
  }
  return [...byDay.entries()]
    .map(([weekday, { total, skipped }]) => ({
      weekday,
      total,
      skipped,
      skippedPercent: total > 0 ? Math.round((skipped / total) * 100) : 0,
    }))
    .sort((a, b) => a.weekday - b.weekday);
}

export interface TaskCategoryStat {
  category: string;
  total: number;
  done: number;
  donePercent: number;
}

/** Completion rate per task category, sorted by total (desc). */
export function taskCategoryStats(
  tasks: { category: string; status: 'open' | 'done' }[]
): TaskCategoryStat[] {
  const byCategory = new Map<string, { total: number; done: number }>();
  for (const task of tasks) {
    const stat = byCategory.get(task.category) ?? { total: 0, done: 0 };
    stat.total += 1;
    if (task.status === 'done') stat.done += 1;
    byCategory.set(task.category, stat);
  }
  return [...byCategory.entries()]
    .map(([category, { total, done }]) => ({
      category,
      total,
      done,
      donePercent: total > 0 ? Math.round((done / total) * 100) : 0,
    }))
    .sort((a, b) => b.total - a.total);
}
