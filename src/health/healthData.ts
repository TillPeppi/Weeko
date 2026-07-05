/**
 * HealthKit adapter — non-iOS fallback (web, Android): HealthKit does not
 * exist here, everything reports unavailable. The real implementation lives
 * in healthData.ios.ts (Metro picks it on iOS).
 */
import type { HealthDay } from '@/domain/healthStats';
import type { HrSample } from '@/domain/coach/strain';
import { EMPTY_DAILY_HEALTH, type DailyHealth } from './types';

export function healthSupported(): boolean {
  return false;
}

export async function connectHealth(): Promise<boolean> {
  return false;
}

export async function loadDailyHealth(_dateIso: string): Promise<DailyHealth> {
  return EMPTY_DAILY_HEALTH;
}

/** Active energy burned that day (kcal) — feeds the food-tracker target. */
export async function loadActiveKcal(_dateIso: string): Promise<number | null> {
  return null;
}

/** Per-day health metrics for a set of dates — feeds the statistics screen. */
export async function loadHealthRange(dates: string[]): Promise<HealthDay[]> {
  return dates.map((date) => ({
    date,
    sleepMinutes: null,
    steps: null,
    restingHr: null,
    hrvMs: null,
  }));
}

/** Intraday heart-rate samples for a day (strain / body level). */
export async function loadHeartRateSamples(_dateIso: string): Promise<HrSample[]> {
  return [];
}
