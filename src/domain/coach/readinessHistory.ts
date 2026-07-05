/**
 * Readiness over time — maps a series of daily health readings to readiness
 * scores (using the personal baseline) for the stats trend. Framework-free.
 */
import type { HealthDay } from '../healthStats';
import { readinessScore, type Readiness, type ReadinessBaseline } from './readiness';

export interface ReadinessPoint {
  date: string;
  /** null when that day has no scoreable signal */
  readiness: Readiness | null;
}

export function readinessSeries(
  days: HealthDay[],
  baseline?: ReadinessBaseline
): ReadinessPoint[] {
  return days.map((day) => ({
    date: day.date,
    readiness: readinessScore(
      { hrvMs: day.hrvMs, restingHr: day.restingHr, asleepMinutes: day.sleepMinutes },
      baseline
    ),
  }));
}

/** Average score over the days that could be scored, or null. */
export function averageReadiness(series: ReadinessPoint[]): number | null {
  const scores = series
    .map((point) => point.readiness?.score)
    .filter((score): score is number => score != null);
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((sum, score) => sum + score, 0) / scores.length);
}
