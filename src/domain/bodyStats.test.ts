import { describe, it, expect } from 'vitest';
import { bodyStatsFrom, bodyMetricSeries, formatWeightChange } from './bodyStats';

function m(date: string, over: Partial<{ weightKg: number; fatPercent: number | null; muscleMassKg: number | null; boneMassKg: number | null; bmrKcal: number | null }> = {}) {
  return {
    id: date,
    date,
    weightKg: 75,
    fatPercent: null,
    muscleMassKg: null,
    boneMassKg: null,
    bmrKcal: null,
    createdAt: `${date}T00:00:00Z`,
    userId: null,
    updatedAt: null,
    ...over,
  };
}

describe('bodyStats', () => {
  it('bodyStatsFrom: empty measurements', () => {
    const stats = bodyStatsFrom([]);
    expect(stats.current).toBeUndefined();
    expect(stats.trend).toEqual([]);
    expect(stats.averageWeight30d).toBe(0);
    expect(stats.trend30dChange).toBe(0);
  });

  it('bodyStatsFrom: single measurement', () => {
    const stats = bodyStatsFrom([
      { id: '1', date: '2024-01-01', weightKg: 75, fatPercent: 15, muscleMassKg: null, boneMassKg: null, bmrKcal: null, createdAt: '2024-01-01T00:00:00Z', userId: null, updatedAt: null },
    ]);
    expect(stats.current?.weightKg).toBe(75);
    expect(stats.current?.fatPercent).toBe(15);
    expect(stats.trend).toHaveLength(1);
    expect(stats.trend[0].change).toBe(0); // first measurement, no prior
    expect(stats.averageWeight30d).toBe(75);
  });

  it('bodyStatsFrom: multi-day trend', () => {
    const stats = bodyStatsFrom([
      { id: '1', date: '2024-01-01', weightKg: 75, fatPercent: 16, muscleMassKg: null, boneMassKg: null, bmrKcal: null, createdAt: '2024-01-01T00:00:00Z', userId: null, updatedAt: null },
      { id: '2', date: '2024-01-08', weightKg: 74.5, fatPercent: 15.5, muscleMassKg: null, boneMassKg: null, bmrKcal: null, createdAt: '2024-01-08T00:00:00Z', userId: null, updatedAt: null },
      { id: '3', date: '2024-01-15', weightKg: 73.8, fatPercent: 15, muscleMassKg: null, boneMassKg: null, bmrKcal: null, createdAt: '2024-01-15T00:00:00Z', userId: null, updatedAt: null },
    ]);
    expect(stats.current?.weightKg).toBe(73.8);
    expect(stats.trend).toHaveLength(3);
    expect(stats.trend[0].change).toBe(0);
    expect(stats.trend[1].change).toBeCloseTo(-0.5, 1);
    expect(stats.trend[2].change).toBeCloseTo(-0.7, 1);
    expect(stats.trend30dChange).toBeCloseTo(-1.2, 1);
  });

  it('bodyStatsFrom: 30-day average', () => {
    const measurements = Array.from({ length: 30 }, (_, i) => ({
      id: String(i + 1),
      date: `2024-01-${String(i + 1).padStart(2, '0')}`,
      weightKg: 75 - i * 0.05,
      fatPercent: 16 - i * 0.02,
      muscleMassKg: null,
      boneMassKg: null,
      bmrKcal: null,
      createdAt: `2024-01-${String(i + 1).padStart(2, '0')}T00:00:00Z`,
      userId: null,
      updatedAt: null,
    }));
    const stats = bodyStatsFrom(measurements);
    expect(stats.trend).toHaveLength(30);
    const avg = measurements.reduce((sum, m) => sum + m.weightKg, 0) / measurements.length;
    expect(stats.averageWeight30d).toBeCloseTo(avg, 1);
  });

  it('formatWeightChange: positive', () => {
    expect(formatWeightChange(0.5, 0.67)).toBe('+0.5 kg (+0.7%)');
  });

  it('formatWeightChange: negative', () => {
    expect(formatWeightChange(-1.2, -1.6)).toBe('-1.2 kg (-1.6%)');
  });

  it('bodyMetricSeries: empty', () => {
    expect(bodyMetricSeries([]).every((s) => s.points.length === 0)).toBe(true);
  });

  it('bodyMetricSeries: per-metric points, change, and gaps', () => {
    const series = bodyMetricSeries([
      m('2024-01-01', { weightKg: 75, muscleMassKg: 33 }),
      m('2024-01-08', { weightKg: 74, muscleMassKg: null }), // muscle not recorded
      m('2024-01-15', { weightKg: 73.5, muscleMassKg: 34 }),
    ]);
    const weight = series.find((s) => s.key === 'weight')!;
    expect(weight.points.map((p) => p.value)).toEqual([75, 74, 73.5]);
    expect(weight.current).toBe(73.5);
    expect(weight.change).toBeCloseTo(-1.5, 5);

    const muscle = series.find((s) => s.key === 'muscle')!;
    expect(muscle.points.map((p) => p.value)).toEqual([33, 34]); // gap skipped
    expect(muscle.change).toBeCloseTo(1, 5);

    const fat = series.find((s) => s.key === 'fat')!;
    expect(fat.points).toHaveLength(0);
    expect(fat.change).toBeNull();
  });

  it('bodyMetricSeries: sorts by date ascending', () => {
    const series = bodyMetricSeries([
      m('2024-02-01', { weightKg: 70 }),
      m('2024-01-01', { weightKg: 72 }),
    ]);
    const weight = series.find((s) => s.key === 'weight')!;
    expect(weight.points.map((p) => p.date)).toEqual(['2024-01-01', '2024-02-01']);
    expect(weight.change).toBeCloseTo(-2, 5);
  });
});
