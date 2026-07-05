/**
 * Personal readiness baseline from recent HealthKit history — a rolling average
 * of HRV and resting heart rate. Makes the readiness score individual instead of
 * comparing against generic adult references.
 *
 * Framework-free; reuses healthStats.healthAverages (which ignores null/zero
 * readings). Returns undefined until enough days carry data, so a noisy one- or
 * two-day sample can't anchor the baseline (which would flatten the score to
 * "always normal").
 */
import { healthAverages, type HealthDay } from '../healthStats';
import type { ReadinessBaseline } from './readiness';

/** Days of history the baseline averages over. */
export const BASELINE_WINDOW_DAYS = 30;
/** Minimum days with data before a personal baseline is trusted. */
export const MIN_BASELINE_DAYS = 7;

export function readinessBaselineFrom(days: HealthDay[]): ReadinessBaseline | undefined {
  const avg = healthAverages(days);
  if (avg.daysWithData < MIN_BASELINE_DAYS) return undefined;
  return { hrvMs: avg.hrvMs, restingHr: avg.restingHr };
}
