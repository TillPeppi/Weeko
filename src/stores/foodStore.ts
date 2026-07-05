/**
 * Food tracker state: the selected day's entries, daily targets (profile-
 * derived, Settings overrides win) and the kcal trend of the selected week.
 */
import { format } from 'date-fns';
import { create } from 'zustand';
import type { FoodEntry } from '@/db/schema';
import {
  addEntry,
  deleteEntry,
  listEntriesBetween,
  listEntriesByDate,
  updateEntry,
  type MealType,
} from '@/db/repos/foodRepo';
import { getProfile } from '@/db/repos/profileRepo';
import {
  dailyMicroAverages,
  dailyTargets,
  kcalByDate,
  nutrientGaps,
  scaleNutrients,
  sumNutrients,
  type NutrientGap,
  type Nutrients,
  type NutrientTargets,
} from '@/domain/nutrition';
import { addDaysIso, isoWeekday } from '@/domain/time';
import { loadActiveKcal } from '@/health/healthData';

export function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export interface TrendDay {
  date: string;
  kcal: number;
}

interface FoodState {
  date: string;
  entries: FoodEntry[];
  /** absolute totals of the selected day */
  totals: Nutrients;
  targets: NutrientTargets;
  /** active energy burned that day (Apple Health, iOS only) — raises the kcal target */
  activityKcal: number | null;
  /** Mon–Sun of the selected date's week */
  trend: TrendDay[];
  /** tracked-but-low micros (Ø of the week's tracked days) */
  microGaps: NutrientGap[];
  gapsDaysTracked: number;
  setDate: (date: string) => Promise<void>;
  refresh: () => Promise<void>;
  add: (values: {
    meal: MealType;
    barcode?: string | null;
    name: string;
    amountG: number;
    /** per 100 g */
    nutrients: Nutrients;
  }) => Promise<void>;
  update: (id: string, values: { amountG: number; meal: MealType }) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

function totalsOf(entries: FoodEntry[]): Nutrients {
  return sumNutrients(entries.map((entry) => scaleNutrients(entry.nutrients, entry.amountG)));
}

export const useFoodStore = create<FoodState>((set, get) => ({
  date: todayIso(),
  entries: [],
  totals: {},
  targets: dailyTargets(null),
  activityKcal: null,
  trend: [],
  microGaps: [],
  gapsDaysTracked: 0,

  setDate: async (date) => {
    set({ date });
    await get().refresh();
  },

  refresh: async () => {
    const { date } = get();
    const monday = addDaysIso(date, 1 - isoWeekday(date));
    const sunday = addDaysIso(monday, 6);
    const [entries, weekEntries, profile, activityKcal] = await Promise.all([
      listEntriesByDate(date),
      listEntriesBetween(monday, sunday),
      getProfile(),
      loadActiveKcal(date).catch(() => null),
    ]);
    const byDate = kcalByDate(weekEntries);
    const trend = Array.from({ length: 7 }, (_, i) => {
      const day = addDaysIso(monday, i);
      return { date: day, kcal: byDate[day] ?? 0 };
    });
    const { avg, daysTracked } = dailyMicroAverages(weekEntries);
    set({
      entries,
      totals: totalsOf(entries),
      targets: dailyTargets(profile, profile?.nutritionGoals),
      activityKcal,
      trend,
      microGaps: nutrientGaps(avg),
      gapsDaysTracked: daysTracked,
    });
  },

  add: async (values) => {
    await addEntry({ ...values, date: get().date });
    await get().refresh();
  },

  update: async (id, values) => {
    await updateEntry(id, values);
    await get().refresh();
  },

  remove: async (id) => {
    await deleteEntry(id);
    await get().refresh();
  },
}));
