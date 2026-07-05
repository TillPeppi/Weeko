import { describe, expect, it } from 'vitest';
import type { HealthDay } from '../healthStats';
import { MIN_BASELINE_DAYS, readinessBaselineFrom } from './baseline';

const day = (date: string, hrvMs: number | null, restingHr: number | null): HealthDay => ({
  date,
  sleepMinutes: null,
  steps: null,
  restingHr,
  hrvMs,
});

const days = (n: number, hrvMs: number, restingHr: number): HealthDay[] =>
  Array.from({ length: n }, (_, i) => day(`2026-06-${String(i + 1).padStart(2, '0')}`, hrvMs, restingHr));

describe('readinessBaselineFrom', () => {
  it('returns undefined below the minimum day count', () => {
    expect(readinessBaselineFrom(days(MIN_BASELINE_DAYS - 1, 50, 60))).toBeUndefined();
  });

  it('averages HRV and resting HR once enough days carry data', () => {
    expect(readinessBaselineFrom(days(MIN_BASELINE_DAYS, 50, 60))).toEqual({
      hrvMs: 50,
      restingHr: 60,
    });
  });

  it('ignores null/zero readings when averaging (via healthAverages)', () => {
    const mixed = [
      day('2026-06-01', 40, 0),
      day('2026-06-02', 60, 58),
      day('2026-06-03', null, 62),
      ...days(MIN_BASELINE_DAYS, 50, 60).slice(0, MIN_BASELINE_DAYS - 3),
    ];
    const result = readinessBaselineFrom(mixed);
    expect(result).toBeDefined();
    // resting HR ignores the 0, HRV ignores the null — both stay plausible
    expect(result!.restingHr).toBeGreaterThan(0);
    expect(result!.hrvMs).toBeGreaterThan(0);
  });

  it('carries a null metric through when that signal has no data', () => {
    const noHrv = Array.from({ length: MIN_BASELINE_DAYS }, (_, i) =>
      day(`2026-06-${String(i + 1).padStart(2, '0')}`, null, 60)
    );
    expect(readinessBaselineFrom(noHrv)).toEqual({ hrvMs: null, restingHr: 60 });
  });
});
