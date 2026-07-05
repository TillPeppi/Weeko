import { describe, expect, it } from 'vitest';
import {
  estimateMaxHr,
  strainFromSamples,
  strainScore,
  timeInZones,
  type HrSample,
} from './strain';

const MAX_HR = 190; // → Z1 95, Z2 114, Z3 133, Z4 152, Z5 171 bpm

/** Samples one bpm every `stepMin` minutes for `count` steps from a base time. */
const ramp = (bpm: number, count: number, stepMin = 1): HrSample[] =>
  Array.from({ length: count }, (_, i) => ({
    start: new Date(Date.UTC(2026, 6, 5, 10, i * stepMin)).toISOString(),
    bpm,
  }));

describe('estimateMaxHr', () => {
  it('uses 220 − age when known, else 190', () => {
    expect(estimateMaxHr(30)).toBe(190);
    expect(estimateMaxHr(null)).toBe(190);
    expect(estimateMaxHr(40)).toBe(180);
  });
});

describe('timeInZones', () => {
  it('attributes gaps to the earlier sample’s zone, ignoring rest', () => {
    // 10 samples 1 min apart at 160 bpm (Z4) → 9 covered minutes in Z4
    const zones = timeInZones(ramp(160, 10), MAX_HR);
    expect(zones[3]).toBe(9); // Z4
    expect(zones[0]).toBe(0);
  });

  it('caps oversized gaps and ignores below-rest bpm', () => {
    const zones = timeInZones(
      [
        { start: '2026-07-05T10:00:00.000Z', bpm: 80 }, // < Z1 → rest
        { start: '2026-07-05T11:00:00.000Z', bpm: 160 }, // 60-min gap capped to 5
      ],
      MAX_HR
    );
    expect(zones.reduce((a, b) => a + b, 0)).toBe(0); // only the rest sample had a following gap
  });
});

describe('strainScore', () => {
  it('is 0 without load and saturates below 100', () => {
    expect(strainScore([0, 0, 0, 0, 0])).toBe(0);
    const score = strainScore([0, 0, 0, 60, 0]);
    expect(score).toBeGreaterThan(0);
    expect(score).toBeLessThan(100);
  });

  it('weights higher zones more', () => {
    expect(strainScore([30, 0, 0, 0, 0])).toBeLessThan(strainScore([0, 0, 0, 0, 30]));
  });
});

describe('strainFromSamples', () => {
  it('returns null with fewer than two samples', () => {
    expect(strainFromSamples([], MAX_HR)).toBeNull();
    expect(strainFromSamples(ramp(150, 1), MAX_HR)).toBeNull();
  });

  it('produces a score and zone breakdown from a workout ramp', () => {
    const result = strainFromSamples(ramp(160, 20), MAX_HR);
    expect(result).not.toBeNull();
    expect(result!.activeMinutes).toBe(19);
    expect(result!.score).toBeGreaterThan(0);
    expect(result!.zoneMinutes[3]).toBe(19); // Z4
  });
});
