import { describe, it, expect } from 'vitest';
import { foodQualityMetrics, weeklyFoodQuality } from './foodQuality';

describe('foodQuality', () => {
  describe('foodQualityMetrics', () => {
    it('identifies protein sources', () => {
      const entries = [
        { name: 'Hühnerfleisch', amountG: 150, nutrients: { kcal: 165, protein: 31, fiber: 0 } },
        { name: 'Lachs', amountG: 100, nutrients: { kcal: 208, protein: 20, fiber: 0 } },
        { name: 'Linsen', amountG: 60, nutrients: { kcal: 106, protein: 9, fiber: 8 } },
        { name: 'Käse', amountG: 50, nutrients: { kcal: 402, protein: 25, fiber: 0 } },
      ];
      const metrics = foodQualityMetrics(entries);
      expect(metrics.proteinSources.meat.gramsCounted).toBeCloseTo(46.5, 1); // 31 * 150/100
      expect(metrics.proteinSources.fish.gramsCounted).toBeCloseTo(20, 1); // 20 * 100/100
      expect(metrics.proteinSources.plant.gramsCounted).toBeCloseTo(5.4, 1); // 9 * 60/100
      expect(metrics.proteinSources.dairy.gramsCounted).toBeCloseTo(12.5, 1); // 25 * 50/100
      expect(metrics.fiberGrams).toBeCloseTo(4.8, 1); // 8 * 60/100
    });

    it('detects vegetables', () => {
      const entries = [
        { name: 'Brokkoli', amountG: 200, nutrients: { kcal: 34, protein: 3, fiber: 2.4 } },
        { name: 'Hähnchenbrust', amountG: 150, nutrients: { kcal: 165, protein: 31, fiber: 0 } },
      ];
      const metrics = foodQualityMetrics(entries);
      expect(metrics.vegetablePercent).toBeGreaterThan(0);
    });

    it('empty entries', () => {
      const metrics = foodQualityMetrics([]);
      expect(metrics.fiberGrams).toBe(0);
      expect(metrics.fiberPerCalorie).toBe(0);
      expect(metrics.vegetablePercent).toBe(0);
    });
  });

  describe('weeklyFoodQuality', () => {
    it('averages daily metrics', () => {
      const dailyMetrics = [
        {
          proteinSources: {
            meat: { gramsCounted: 50, percent: 40 },
            fish: { gramsCounted: 30, percent: 24 },
            plant: { gramsCounted: 20, percent: 16 },
            dairy: { gramsCounted: 25, percent: 20 },
            egg: { gramsCounted: 0, percent: 0 },
            other: { gramsCounted: 0, percent: 0 },
          },
          vegetablePercent: 25,
          fiberGrams: 25,
          fiberPerCalorie: 3.2,
        },
        {
          proteinSources: {
            meat: { gramsCounted: 60, percent: 45 },
            fish: { gramsCounted: 20, percent: 15 },
            plant: { gramsCounted: 25, percent: 18 },
            dairy: { gramsCounted: 20, percent: 22 },
            egg: { gramsCounted: 0, percent: 0 },
            other: { gramsCounted: 0, percent: 0 },
          },
          vegetablePercent: 22,
          fiberGrams: 28,
          fiberPerCalorie: 3.1,
        },
      ];
      const weekly = weeklyFoodQuality(dailyMetrics);
      expect(weekly.meatPercent).toBeCloseTo(42.5, 1);
      expect(weekly.fishPercent).toBeCloseTo(19.5, 1);
      expect(weekly.plantPercent).toBeCloseTo(17, 1);
      expect(weekly.dairyPercent).toBeCloseTo(21, 1);
      expect(weekly.avgFiberGrams).toBeCloseTo(26.5, 1);
    });
  });
});
