/**
 * Currently displayed week + today's blocks. Single source of truth for the
 * Week and Today tabs so status changes reflect everywhere immediately.
 */
import { create } from 'zustand';
import type { Block } from '@/db/schema';
import type { BlockStatus } from '@/domain/types';
import {
  getBlocksForDate,
  getWeekWithBlocks,
  setBlockStatus as repoSetBlockStatus,
  type WeekWithBlocks,
} from '@/db/repos/weekRepo';
import { isoWeekOf } from '@/domain/time';

interface WeekState {
  /** selected week (defaults to the current ISO week) */
  year: number;
  isoWeek: number;
  data: WeekWithBlocks | null;
  todayBlocks: Block[];
  loading: boolean;
  setWeek: (year: number, isoWeek: number) => void;
  refresh: () => Promise<void>;
  setBlockStatus: (blockId: number, status: BlockStatus) => Promise<void>;
}

function todayIso(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

const initial = isoWeekOf(todayIso());

export const useWeekStore = create<WeekState>((set, get) => ({
  year: initial.year,
  isoWeek: initial.isoWeek,
  data: null,
  todayBlocks: [],
  loading: false,

  setWeek: (year, isoWeek) => {
    set({ year, isoWeek });
    void get().refresh();
  },

  refresh: async () => {
    const { year, isoWeek } = get();
    set({ loading: true });
    try {
      const [data, todayBlocks] = await Promise.all([
        getWeekWithBlocks(year, isoWeek),
        getBlocksForDate(todayIso()),
      ]);
      set({ data: data ?? null, todayBlocks });
    } finally {
      set({ loading: false });
    }
  },

  setBlockStatus: async (blockId, status) => {
    await repoSetBlockStatus(blockId, status);
    await get().refresh();
  },
}));

export { todayIso };
