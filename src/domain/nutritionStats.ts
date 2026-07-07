/**
 * Nutrition statistics across weeks: macro weekly averages vs. targets,
 * kcal balance (lean-gain feedback), meal distribution, top foods and
 * micro-nutrient weekly trend. Framework-free.
 *
 * All functions take food-entry-shaped rows: per-100 g nutrients + amount.
 */
import {
  MICRO_KEYS,
  microPercent,
  scaleNutrients,
  sumNutrients,
  type MicroKey,
  type Nutrients,
} from './nutrition';
import { addDaysIso, recentIsoWeeks, type IsoWeekRef } from './time';

export interface FoodEntryLike {
  /** YYYY-MM-DD */
  date: string;
  meal: string;
  name: string;
  amountG: number;
  /** per 100 g */
  nutrients: Nutrients;
}

function absolute(entry: FoodEntryLike): Nutrients {
  return scaleNutrients(entry.nutrients, entry.amountG);
}

export interface DailyNutritionPoint {
  /** YYYY-MM-DD */
  date: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  sugars: number;
  fiber: number;
  salt: number;
  saturatedFat: number;
}

/** Per-day macro totals for every day that has ≥1 entry (ascending). */
export function dailyNutrition(entries: FoodEntryLike[]): DailyNutritionPoint[] {
  const byDate = new Map<string, FoodEntryLike[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date);
    if (list) list.push(entry);
    else byDate.set(entry.date, [entry]);
  }
  const round1 = (value: number | undefined) => Math.round((value ?? 0) * 10) / 10;
  return [...byDate.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, list]) => {
      const total = sumNutrients(list.map(absolute));
      return {
        date,
        kcal: Math.round(total.kcal ?? 0),
        protein: Math.round(total.protein ?? 0),
        carbs: Math.round(total.carbs ?? 0),
        fat: Math.round(total.fat ?? 0),
        sugars: Math.round(total.sugars ?? 0),
        fiber: Math.round(total.fiber ?? 0),
        salt: round1(total.salt),
        saturatedFat: Math.round(total.saturatedFat ?? 0),
      };
    });
}

export interface WeeklyNutritionPoint extends IsoWeekRef {
  /** days of the week with ≥1 entry */
  trackedDays: number;
  /** Ø per tracked day */
  avgKcal: number;
  avgProtein: number;
  avgCarbs: number;
  avgFat: number;
  avgSugars: number;
  avgFiber: number;
  avgSalt: number;
  avgSaturatedFat: number;
}

/** Weekly macro averages over the last `weeks` ISO weeks (oldest first). */
export function weeklyNutrition(
  entries: FoodEntryLike[],
  today: string,
  weeks = 4
): WeeklyNutritionPoint[] {
  return recentIsoWeeks(today, weeks).map((ref) => {
    const end = addDaysIso(ref.monday, 6);
    const inWeek = entries.filter((e) => e.date >= ref.monday && e.date <= end);
    const trackedDays = new Set(inWeek.map((e) => e.date)).size;
    if (trackedDays === 0) {
      return {
        ...ref,
        trackedDays: 0,
        avgKcal: 0,
        avgProtein: 0,
        avgCarbs: 0,
        avgFat: 0,
        avgSugars: 0,
        avgFiber: 0,
        avgSalt: 0,
        avgSaturatedFat: 0,
      };
    }
    const total = sumNutrients(inWeek.map(absolute));
    const avg = (value: number | undefined) => Math.round((value ?? 0) / trackedDays);
    // salt needs one decimal — daily values are in low single digits
    const avg1 = (value: number | undefined) =>
      Math.round(((value ?? 0) / trackedDays) * 10) / 10;
    return {
      ...ref,
      trackedDays,
      avgKcal: avg(total.kcal),
      avgProtein: avg(total.protein),
      avgCarbs: avg(total.carbs),
      avgFat: avg(total.fat),
      avgSugars: avg(total.sugars),
      avgFiber: avg(total.fiber),
      avgSalt: avg1(total.salt),
      avgSaturatedFat: avg(total.saturatedFat),
    };
  });
}

export interface KcalBalance {
  trackedDays: number;
  totalKcal: number;
  /** Σ target over tracked days */
  totalTargetKcal: number;
  /** positive = surplus, negative = deficit */
  surplusKcal: number;
  /** surplus converted via 7700 kcal ≈ 1 kg */
  estimatedKg: number;
}

/** kcal balance of a set of entries (e.g. one week) vs. a daily target. */
export function kcalBalance(entries: FoodEntryLike[], dailyTargetKcal: number): KcalBalance {
  const trackedDays = new Set(entries.map((e) => e.date)).size;
  const totalKcal = Math.round(
    entries.reduce((sum, e) => sum + (e.nutrients.kcal ?? 0) * (e.amountG / 100), 0)
  );
  const totalTargetKcal = trackedDays * dailyTargetKcal;
  const surplusKcal = totalKcal - totalTargetKcal;
  return {
    trackedDays,
    totalKcal,
    totalTargetKcal,
    surplusKcal,
    estimatedKg: Math.round((surplusKcal / 7700) * 100) / 100,
  };
}

/** kcal per meal (absolute) plus each meal's share of the total. */
export function mealDistribution(
  entries: FoodEntryLike[]
): { meal: string; kcal: number; percent: number }[] {
  const byMeal = new Map<string, number>();
  for (const entry of entries) {
    const kcal = (entry.nutrients.kcal ?? 0) * (entry.amountG / 100);
    byMeal.set(entry.meal, (byMeal.get(entry.meal) ?? 0) + kcal);
  }
  const total = [...byMeal.values()].reduce((sum, kcal) => sum + kcal, 0);
  return [...byMeal.entries()].map(([meal, kcal]) => ({
    meal,
    kcal: Math.round(kcal),
    percent: total > 0 ? Math.round((kcal / total) * 100) : 0,
  }));
}

export interface TopFood {
  name: string;
  /** number of entries */
  count: number;
  /** Σ kcal across all entries */
  kcal: number;
}

/** Most-logged foods by total kcal (ties broken by count). */
export function topFoods(entries: FoodEntryLike[], limit = 5): TopFood[] {
  const byName = new Map<string, TopFood>();
  for (const entry of entries) {
    const kcal = (entry.nutrients.kcal ?? 0) * (entry.amountG / 100);
    const item = byName.get(entry.name) ?? { name: entry.name, count: 0, kcal: 0 };
    item.count += 1;
    item.kcal += kcal;
    byName.set(entry.name, item);
  }
  return [...byName.values()]
    .map((item) => ({ ...item, kcal: Math.round(item.kcal) }))
    .sort((a, b) => b.kcal - a.kcal || b.count - a.count)
    .slice(0, limit);
}

export interface WeeklyMicroPoint extends IsoWeekRef {
  trackedDays: number;
  /** Ø % of the EU reference value per tracked day; only micros with data */
  percentByMicro: Partial<Record<MicroKey, number>>;
}

/**
 * Weekly Ø micro coverage (% NRV per tracked day), last `weeks` ISO weeks.
 * Micros without any data in a week are omitted (missing labels ≠ deficiency).
 */
export function weeklyMicros(
  entries: FoodEntryLike[],
  today: string,
  weeks = 4
): WeeklyMicroPoint[] {
  return recentIsoWeeks(today, weeks).map((ref) => {
    const end = addDaysIso(ref.monday, 6);
    const inWeek = entries.filter((e) => e.date >= ref.monday && e.date <= end);
    const trackedDays = new Set(inWeek.map((e) => e.date)).size;
    const percentByMicro: Partial<Record<MicroKey, number>> = {};
    if (trackedDays > 0) {
      const total = sumNutrients(inWeek.map(absolute));
      for (const key of MICRO_KEYS) {
        const value = total.micros?.[key];
        if (value !== undefined && value > 0) {
          percentByMicro[key] = microPercent(key, value / trackedDays);
        }
      }
    }
    return { ...ref, trackedDays, percentByMicro };
  });
}
