import { describe, expect, it } from 'vitest';
import {
  DEFAULT_HRV_BASELINE_MS,
  READINESS_HIGH_BAND,
  READINESS_LOW_BAND,
  TARGET_SLEEP_MINUTES,
  readinessBand,
  readinessScore,
} from './readiness';

describe('readinessBand', () => {
  it('splits into low / moderate / high at the thresholds', () => {
    expect(readinessBand(READINESS_LOW_BAND - 1)).toBe('low');
    expect(readinessBand(READINESS_LOW_BAND)).toBe('moderate');
    expect(readinessBand(READINESS_HIGH_BAND - 1)).toBe('moderate');
    expect(readinessBand(READINESS_HIGH_BAND)).toBe('high');
  });
});

describe('readinessScore', () => {
  it('returns null when no signal is present', () => {
    expect(readinessScore({ hrvMs: null, restingHr: null, asleepMinutes: null })).toBeNull();
  });

  it('scores a perfect night at 100 against the default baseline', () => {
    const result = readinessScore({
      hrvMs: DEFAULT_HRV_BASELINE_MS, // ratio 1.0 (capped)
      restingHr: 60, // base/current = 1.0
      asleepMinutes: TARGET_SLEEP_MINUTES, // ratio 1.0
    });
    expect(result).toEqual({ score: 100, band: 'high', usedSignals: 3 });
  });

  it('renormalizes when only some signals exist', () => {
    // only sleep, at half the target → 50, all weight on the one signal
    const result = readinessScore({ hrvMs: null, restingHr: null, asleepMinutes: 240 });
    expect(result).toEqual({ score: 50, band: 'moderate', usedSignals: 1 });
  });

  it('drops readiness when HRV is far below the personal baseline', () => {
    const result = readinessScore(
      { hrvMs: 20, restingHr: 70, asleepMinutes: 300 },
      { hrvMs: 80, restingHr: 55 }
    );
    // hrv 20/80=.25*.4 + sleep 300/480=.625*.4 + rhr 55/70=.786*.2 = .5072 → 51
    expect(result?.score).toBe(51);
    expect(result?.band).toBe('moderate');
  });

  it('caps each signal at 1 so an exceptional night cannot exceed 100', () => {
    const result = readinessScore({ hrvMs: 999, restingHr: 30, asleepMinutes: 1000 });
    expect(result?.score).toBe(100);
  });

  it('ignores zero / negative readings as missing', () => {
    const result = readinessScore({ hrvMs: 0, restingHr: -5, asleepMinutes: 480 });
    expect(result).toEqual({ score: 100, band: 'high', usedSignals: 1 });
  });
});
