/**
 * Health statistics: averages over a range of daily Apple-Health values
 * (sleep, steps, resting HR, HRV). Framework-free — the HealthKit adapter
 * delivers the per-day values, this module only aggregates.
 */

export interface HealthDay {
  /** YYYY-MM-DD */
  date: string;
  sleepMinutes: number | null;
  steps: number | null;
  restingHr: number | null;
  hrvMs: number | null;
}

export interface HealthAverages {
  sleepMinutes: number | null;
  steps: number | null;
  restingHr: number | null;
  hrvMs: number | null;
  /** days that carried at least one value */
  daysWithData: number;
}

function avg(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v !== null && v > 0);
  if (present.length === 0) return null;
  return Math.round(present.reduce((sum, v) => sum + v, 0) / present.length);
}

export function healthAverages(days: HealthDay[]): HealthAverages {
  return {
    sleepMinutes: avg(days.map((d) => d.sleepMinutes)),
    steps: avg(days.map((d) => d.steps)),
    restingHr: avg(days.map((d) => d.restingHr)),
    hrvMs: avg(days.map((d) => d.hrvMs)),
    daysWithData: days.filter(
      (d) => d.sleepMinutes !== null || d.steps !== null || d.restingHr !== null || d.hrvMs !== null
    ).length,
  };
}
