import type { SleepSummary } from '@/domain/health';

/** One day of Apple-Health data as shown on the Today screen. */
export interface DailyHealth {
  /** last night (18:00 previous day – 12:00) */
  sleep: SleepSummary | null;
  steps: number | null;
  activeKcal: number | null;
  restingHr: number | null;
  /** heart-rate variability (SDNN) in ms */
  hrvMs: number | null;
}

export const EMPTY_DAILY_HEALTH: DailyHealth = {
  sleep: null,
  steps: null,
  activeKcal: null,
  restingHr: null,
  hrvMs: null,
};

export function hasAnyHealthData(data: DailyHealth): boolean {
  return (
    data.sleep !== null ||
    data.steps !== null ||
    data.activeKcal !== null ||
    data.restingHr !== null ||
    data.hrvMs !== null
  );
}
