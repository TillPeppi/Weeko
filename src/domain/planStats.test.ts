import { describe, expect, it } from 'vitest';
import {
  taskCategoryStats,
  typeStats,
  weekdayStats,
  weeklyAdherence,
  type PlanBlock,
} from './planStats';
import type { BlockStatus, BlockType } from './types';

const block = (
  date: string,
  type: BlockType,
  status: BlockStatus,
  start = '08:00',
  end = '09:00'
): PlanBlock => ({ date, type, status, start, end });

describe('weeklyAdherence', () => {
  it('counts done/skipped/open per week, sorted oldest first', () => {
    const points = weeklyAdherence([
      {
        year: 2026,
        isoWeek: 27,
        blocks: [
          block('2026-06-29', 'work', 'done'),
          block('2026-06-30', 'training', 'skipped'),
          block('2026-07-01', 'hobby', 'planned'),
          block('2026-07-02', 'work', 'done'),
        ],
      },
      { year: 2026, isoWeek: 26, blocks: [block('2026-06-22', 'work', 'done')] },
    ]);
    expect(points[0]).toMatchObject({ isoWeek: 26, donePercent: 100 });
    expect(points[1]).toMatchObject({
      isoWeek: 27,
      total: 4,
      done: 2,
      skipped: 1,
      open: 1,
      donePercent: 50,
    });
  });

  it('handles year boundaries in the sort (KW 52/2025 before KW 1/2026)', () => {
    const points = weeklyAdherence([
      { year: 2026, isoWeek: 1, blocks: [] },
      { year: 2025, isoWeek: 52, blocks: [] },
    ]);
    expect(points.map((p) => p.year)).toEqual([2025, 2026]);
  });
});

describe('typeStats', () => {
  it('sums planned/done minutes and skip rates per type', () => {
    const stats = typeStats([
      block('2026-06-29', 'work', 'done', '08:00', '16:00'), // 480 min
      block('2026-06-30', 'work', 'done', '08:00', '16:00'),
      block('2026-06-30', 'training', 'skipped', '18:00', '19:00'),
      block('2026-07-01', 'training', 'done', '18:00', '19:30'),
    ]);
    expect(stats[0]).toMatchObject({
      type: 'work',
      total: 2,
      plannedMinutes: 960,
      doneMinutes: 960,
      skippedPercent: 0,
    });
    expect(stats[1]).toMatchObject({
      type: 'training',
      total: 2,
      skipped: 1,
      skippedPercent: 50,
      plannedMinutes: 150,
      doneMinutes: 90,
    });
  });
});

describe('weekdayStats', () => {
  it('computes skip rates per ISO weekday, only for weekdays with blocks', () => {
    const stats = weekdayStats([
      block('2026-06-29', 'work', 'done'), // Monday
      block('2026-06-29', 'hobby', 'skipped'),
      block('2026-07-05', 'free', 'done'), // Sunday
    ]);
    expect(stats).toEqual([
      { weekday: 1, total: 2, skipped: 1, skippedPercent: 50 },
      { weekday: 7, total: 1, skipped: 0, skippedPercent: 0 },
    ]);
  });
});

describe('taskCategoryStats', () => {
  it('computes completion per category, sorted by volume', () => {
    const stats = taskCategoryStats([
      { category: 'mealprep', status: 'done' },
      { category: 'mealprep', status: 'open' },
      { category: 'mealprep', status: 'done' },
      { category: 'guitar', status: 'open' },
    ]);
    expect(stats[0]).toEqual({ category: 'mealprep', total: 3, done: 2, donePercent: 67 });
    expect(stats[1]).toEqual({ category: 'guitar', total: 1, done: 0, donePercent: 0 });
  });
});
