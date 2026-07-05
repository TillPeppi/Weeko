import { describe, expect, it } from 'vitest';
import type { HealthDay } from '../healthStats';
import { averageReadiness, readinessSeries } from './readinessHistory';

const day = (
  date: string,
  hrvMs: number | null,
  restingHr: number | null,
  sleepMinutes: number | null
): HealthDay => ({ date, hrvMs, restingHr, sleepMinutes, steps: null });

describe('readinessSeries', () => {
  it('scores each day, null when a day has no signal', () => {
    const series = readinessSeries([
      day('2026-07-01', null, null, 480), // sleep only → 100
      day('2026-07-02', null, null, null), // nothing → null
    ]);
    expect(series[0].readiness?.score).toBe(100);
    expect(series[1].readiness).toBeNull();
    expect(series.map((p) => p.date)).toEqual(['2026-07-01', '2026-07-02']);
  });

  it('applies the personal baseline', () => {
    const [point] = readinessSeries([day('2026-07-01', 40, null, null)], { hrvMs: 80 });
    expect(point.readiness?.score).toBe(50); // 40/80 = 0.5
  });
});

describe('averageReadiness', () => {
  it('averages only the scoreable days', () => {
    const series = readinessSeries([
      day('2026-07-01', null, null, 480), // 100
      day('2026-07-02', null, null, 240), // 50
      day('2026-07-03', null, null, null), // null → ignored
    ]);
    expect(averageReadiness(series)).toBe(75);
  });

  it('is null when nothing is scoreable', () => {
    expect(averageReadiness(readinessSeries([day('2026-07-01', null, null, null)]))).toBeNull();
  });
});
