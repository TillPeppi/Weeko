import { describe, expect, it } from 'vitest';
import {
  BASELINE_SLEEP_NEED_MIN,
  MAX_DEBT_CARRYOVER_MIN,
  MAX_STRAIN_BONUS_MIN,
  sleepDebt,
  sleepNeed,
} from './sleepNeed';

describe('sleepDebt', () => {
  it('sums per-night deficits, ignoring nulls and surplus', () => {
    // baseline 480; deficits: 60 + 0 (surplus) + 30 = 90
    expect(sleepDebt([420, 500, 450, null])).toBe(90);
  });

  it('is 0 when nothing is below baseline', () => {
    expect(sleepDebt([480, 500])).toBe(0);
  });
});

describe('sleepNeed', () => {
  it('is the baseline with no debt and no strain', () => {
    expect(sleepNeed({ debtMin: 0, strain: null })).toBe(BASELINE_SLEEP_NEED_MIN);
  });

  it('adds half the debt, capped', () => {
    expect(sleepNeed({ debtMin: 100, strain: 0 })).toBe(BASELINE_SLEEP_NEED_MIN + 50);
    expect(sleepNeed({ debtMin: 1000, strain: 0 })).toBe(
      BASELINE_SLEEP_NEED_MIN + MAX_DEBT_CARRYOVER_MIN
    );
  });

  it('adds a strain bonus scaled to 0–100', () => {
    expect(sleepNeed({ debtMin: 0, strain: 100 })).toBe(
      BASELINE_SLEEP_NEED_MIN + MAX_STRAIN_BONUS_MIN
    );
    expect(sleepNeed({ debtMin: 0, strain: 50 })).toBe(
      BASELINE_SLEEP_NEED_MIN + Math.round(MAX_STRAIN_BONUS_MIN / 2)
    );
  });
});
