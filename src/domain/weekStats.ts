/**
 * Week balance (Wochenbilanz): done/skipped/open counts for a week's blocks,
 * overall and per block type. Framework-free.
 */
import type { BlockStatus, BlockType } from './types';

export interface StatusCounts {
  total: number;
  done: number;
  skipped: number;
  /** planned + active */
  open: number;
}

export interface WeekStats extends StatusCounts {
  byType: Partial<Record<BlockType, StatusCounts>>;
}

function count(into: StatusCounts, status: BlockStatus): void {
  into.total += 1;
  if (status === 'done') into.done += 1;
  else if (status === 'skipped') into.skipped += 1;
  else into.open += 1;
}

export function weekStats(blocks: { type: BlockType; status: BlockStatus }[]): WeekStats {
  const stats: WeekStats = { total: 0, done: 0, skipped: 0, open: 0, byType: {} };
  for (const block of blocks) {
    count(stats, block.status);
    const typeCounts = (stats.byType[block.type] ??= { total: 0, done: 0, skipped: 0, open: 0 });
    count(typeCounts, block.status);
  }
  return stats;
}
