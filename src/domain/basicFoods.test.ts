import { describe, expect, it } from 'vitest';
import { BASIC_FOODS, searchBasicFoods } from './basicFoods';
import { dailyMicroAverages, nutrientGaps, scaleNutrients } from './nutrition';

describe('BASIC_FOODS data sanity', () => {
  it('every food has kcal, unique key and both names', () => {
    const keys = new Set<string>();
    for (const food of BASIC_FOODS) {
      expect(food.nutrients.kcal, food.key).toBeGreaterThan(0);
      expect(food.de.length, food.key).toBeGreaterThan(1);
      expect(food.en.length, food.key).toBeGreaterThan(1);
      expect(food.servingG, food.key).toBeGreaterThan(0);
      expect(keys.has(food.key)).toBe(false);
      keys.add(food.key);
    }
  });

  it('micros stay in a plausible mg range (µg values converted)', () => {
    for (const food of BASIC_FOODS) {
      for (const [key, value] of Object.entries(food.nutrients.micros ?? {})) {
        expect(value, `${food.key}.${key}`).toBeGreaterThan(0);
        expect(value, `${food.key}.${key}`).toBeLessThan(1000); // nothing above 1 g/100 g
      }
    }
  });
});

describe('searchBasicFoods', () => {
  it('finds German names with prefix priority', () => {
    const results = searchBasicFoods('brok', 'de');
    expect(results[0]?.key).toBe('broccoli');
  });

  it('falls back to the other language', () => {
    const results = searchBasicFoods('chicken', 'de');
    expect(results.some((f) => f.key === 'chicken-breast')).toBe(true);
  });

  it('requires at least 2 characters', () => {
    expect(searchBasicFoods('a', 'de')).toEqual([]);
  });
});

describe('dailyMicroAverages + nutrientGaps', () => {
  it('averages micros over tracked days and flags low ones', () => {
    const apple = BASIC_FOODS.find((f) => f.key === 'apple')!;
    const entries = [
      { date: '2026-07-01', amountG: 150, nutrients: apple.nutrients },
      { date: '2026-07-02', amountG: 150, nutrients: apple.nutrients },
    ];
    const { avg, daysTracked } = dailyMicroAverages(entries);
    expect(daysTracked).toBe(2);
    // 4.6 mg C per 100 g × 1.5 = 6.9 mg per day
    expect(avg.vitaminC).toBeCloseTo(6.9, 1);

    const gaps = nutrientGaps(avg);
    // vitamin C at ~9 % of 80 mg → flagged; untracked micros (e.g. B12) NOT flagged
    expect(gaps.some((gap) => gap.key === 'vitaminC')).toBe(true);
    expect(gaps.some((gap) => gap.key === 'vitaminB12')).toBe(false);
  });

  it('does not flag micros that reach the threshold', () => {
    const pepper = BASIC_FOODS.find((f) => f.key === 'bell-pepper')!;
    const { avg } = dailyMicroAverages([
      { date: '2026-07-01', amountG: 150, nutrients: pepper.nutrients },
    ]);
    // 128 mg C × 1.5 = 192 mg = 240 % of NRV
    const gaps = nutrientGaps(avg);
    expect(gaps.some((gap) => gap.key === 'vitaminC')).toBe(false);
  });

  it('scaleNutrients carries basic-food micros through', () => {
    const spinach = BASIC_FOODS.find((f) => f.key === 'spinach')!;
    const scaled = scaleNutrients(spinach.nutrients, 200);
    expect(scaled.micros?.iron).toBeCloseTo(5.4, 1);
  });
});
