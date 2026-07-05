import { describe, expect, it } from 'vitest';
import { healthAverages, type HealthDay } from './healthStats';

const day = (date: string, values: Partial<Omit<HealthDay, 'date'>>): HealthDay => ({
  date,
  sleepMinutes: null,
  steps: null,
  restingHr: null,
  hrvMs: null,
  ...values,
});

describe('healthAverages', () => {
  it('averages only days with values per metric', () => {
    const result = healthAverages([
      day('2026-07-01', { sleepMinutes: 420, steps: 8000, restingHr: 50 }),
      day('2026-07-02', { sleepMinutes: 480, steps: 12000 }),
      day('2026-07-03', {}),
    ]);
    expect(result.sleepMinutes).toBe(450);
    expect(result.steps).toBe(10000);
    expect(result.restingHr).toBe(50);
    expect(result.hrvMs).toBeNull();
    expect(result.daysWithData).toBe(2);
  });

  it('handles empty input', () => {
    const result = healthAverages([]);
    expect(result.sleepMinutes).toBeNull();
    expect(result.daysWithData).toBe(0);
  });
});
