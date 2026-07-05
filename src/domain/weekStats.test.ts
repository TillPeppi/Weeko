import { describe, expect, it } from 'vitest';
import { weekStats } from './weekStats';
import type { BlockStatus, BlockType } from './types';

const block = (type: BlockType, status: BlockStatus) => ({ type, status });

describe('weekStats', () => {
  it('counts done/skipped/open overall and per type', () => {
    const stats = weekStats([
      block('work', 'done'),
      block('work', 'planned'),
      block('training', 'done'),
      block('training', 'skipped'),
      block('dog', 'active'),
    ]);
    expect(stats).toMatchObject({ total: 5, done: 2, skipped: 1, open: 2 });
    expect(stats.byType.work).toEqual({ total: 2, done: 1, skipped: 0, open: 1 });
    expect(stats.byType.training).toEqual({ total: 2, done: 1, skipped: 1, open: 0 });
    expect(stats.byType.dog).toEqual({ total: 1, done: 0, skipped: 0, open: 1 });
  });

  it('handles empty weeks', () => {
    expect(weekStats([])).toEqual({ total: 0, done: 0, skipped: 0, open: 0, byType: {} });
  });
});
