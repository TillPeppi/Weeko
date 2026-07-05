import { describe, expect, it } from 'vitest';
import {
  kcalBalance,
  mealDistribution,
  topFoods,
  weeklyMicros,
  weeklyNutrition,
  type FoodEntryLike,
} from './nutritionStats';

const entry = (
  date: string,
  kcal: number,
  extras: Partial<FoodEntryLike> & { nutrients?: FoodEntryLike['nutrients'] } = {}
): FoodEntryLike => ({
  date,
  meal: extras.meal ?? 'lunch',
  name: extras.name ?? 'Testfood',
  amountG: extras.amountG ?? 100,
  nutrients: { kcal, ...extras.nutrients },
});

describe('weeklyNutrition', () => {
  // 2026-07-03 (Fri), ISO week 27 — Monday 2026-06-29
  const today = '2026-07-03';

  it('averages macros per tracked day and week', () => {
    const points = weeklyNutrition(
      [
        entry('2026-06-29', 2000, { nutrients: { kcal: 2000, protein: 150, carbs: 200, fat: 60 } }),
        entry('2026-06-30', 2400, { nutrients: { kcal: 2400, protein: 130, carbs: 260, fat: 80 } }),
        entry('2026-06-24', 1800, { nutrients: { kcal: 1800, protein: 100, carbs: 180, fat: 50 } }),
      ],
      today,
      2
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ isoWeek: 26, trackedDays: 1, avgKcal: 1800, avgProtein: 100 });
    expect(points[1]).toMatchObject({
      isoWeek: 27,
      trackedDays: 2,
      avgKcal: 2200,
      avgProtein: 140,
      avgCarbs: 230,
      avgFat: 70,
    });
  });

  it('scales per-100 g values by the amount', () => {
    const points = weeklyNutrition([entry('2026-07-01', 200, { amountG: 250 })], today, 1);
    expect(points[0].avgKcal).toBe(500);
  });

  it('averages sugars, fiber, salt and saturated fat', () => {
    const points = weeklyNutrition(
      [
        entry('2026-06-29', 2000, {
          nutrients: { kcal: 2000, sugars: 40, fiber: 28, salt: 4.2, saturatedFat: 18 },
        }),
        entry('2026-06-30', 2400, {
          nutrients: { kcal: 2400, sugars: 60, fiber: 32, salt: 6.4, saturatedFat: 22 },
        }),
      ],
      today,
      1
    );
    expect(points[0]).toMatchObject({
      trackedDays: 2,
      avgSugars: 50,
      avgFiber: 30,
      avgSalt: 5.3,
      avgSaturatedFat: 20,
    });
  });

  it('returns zeroed weeks without entries', () => {
    const points = weeklyNutrition([], today, 2);
    expect(points.every((p) => p.trackedDays === 0 && p.avgKcal === 0)).toBe(true);
  });
});

describe('kcalBalance', () => {
  it('computes surplus over tracked days and converts to kg', () => {
    const balance = kcalBalance(
      [entry('2026-06-29', 2800), entry('2026-06-30', 2900), entry('2026-06-30', 100)],
      2500
    );
    expect(balance.trackedDays).toBe(2);
    expect(balance.totalKcal).toBe(5800);
    expect(balance.totalTargetKcal).toBe(5000);
    expect(balance.surplusKcal).toBe(800);
    expect(balance.estimatedKg).toBe(0.1);
  });

  it('reports deficits as negative values', () => {
    const balance = kcalBalance([entry('2026-06-29', 1800)], 2500);
    expect(balance.surplusKcal).toBe(-700);
    expect(balance.estimatedKg).toBe(-0.09);
  });

  it('handles no entries', () => {
    expect(kcalBalance([], 2500)).toMatchObject({ trackedDays: 0, surplusKcal: 0 });
  });
});

describe('mealDistribution', () => {
  it('splits kcal by meal with percentages', () => {
    const result = mealDistribution([
      entry('2026-07-01', 600, { meal: 'breakfast' }),
      entry('2026-07-01', 300, { meal: 'snack' }),
      entry('2026-07-02', 300, { meal: 'snack' }),
    ]);
    expect(result).toContainEqual({ meal: 'breakfast', kcal: 600, percent: 50 });
    expect(result).toContainEqual({ meal: 'snack', kcal: 600, percent: 50 });
  });
});

describe('topFoods', () => {
  it('ranks by total kcal', () => {
    const result = topFoods(
      [
        entry('2026-07-01', 500, { name: 'Nutella' }),
        entry('2026-07-02', 500, { name: 'Nutella' }),
        entry('2026-07-01', 700, { name: 'Skyr' }),
      ],
      2
    );
    expect(result[0]).toEqual({ name: 'Nutella', count: 2, kcal: 1000 });
    expect(result[1]).toEqual({ name: 'Skyr', count: 1, kcal: 700 });
  });
});

describe('weeklyMicros', () => {
  const today = '2026-07-03';

  it('averages micro coverage per tracked day, omitting micros without data', () => {
    const points = weeklyMicros(
      [
        // 80 mg vitamin C = 100 % NRV, tracked on one day
        entry('2026-06-29', 50, { nutrients: { kcal: 50, micros: { vitaminC: 80 } } }),
        entry('2026-06-30', 50, { nutrients: { kcal: 50 } }),
      ],
      today,
      1
    );
    expect(points[0].trackedDays).toBe(2);
    expect(points[0].percentByMicro.vitaminC).toBe(50); // 80 mg over 2 days = 50 %
    expect(points[0].percentByMicro.iron).toBeUndefined();
  });
});
