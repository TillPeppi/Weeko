/**
 * Readiness / recovery score — the coach engine's core heuristic (no LLM).
 *
 * Turns raw HealthKit signals (HRV, sleep, resting heart rate) into a single
 * 0–100 score, the way Bevel/Whoop do — but as an explainable, deterministic
 * formula living in the framework-free domain layer.
 *
 * Each signal is normalized to 0–1 and combined with a fixed weight. Missing
 * signals are simply dropped (the remaining weights are renormalized), so a
 * single night of sleep still yields a score. Personal baselines (rolling
 * 30-day averages) make it individual; without them we fall back to generic
 * adult references.
 */

/** Target time asleep for a full-recovery night. */
export const TARGET_SLEEP_MINUTES = 8 * 60;

/** Generic adult references, used when no personal baseline is known yet. */
export const DEFAULT_HRV_BASELINE_MS = 55;
export const DEFAULT_RESTING_HR_BASELINE = 60;

/** Score band thresholds (score < LOW = low, < HIGH = moderate, else high). */
export const READINESS_LOW_BAND = 40;
export const READINESS_HIGH_BAND = 70;

const WEIGHT_HRV = 0.4;
const WEIGHT_SLEEP = 0.4;
const WEIGHT_RESTING_HR = 0.2;

export type ReadinessBand = 'low' | 'moderate' | 'high';

/** Today's raw signals; any field may be null when the device didn't record it. */
export interface ReadinessInput {
  /** heart-rate variability (SDNN) in ms — higher is better */
  hrvMs: number | null;
  /** resting heart rate in bpm — lower is better */
  restingHr: number | null;
  /** total time asleep last night in minutes */
  asleepMinutes: number | null;
}

/** Personal rolling averages; unset fields fall back to the generic references. */
export interface ReadinessBaseline {
  hrvMs?: number | null;
  restingHr?: number | null;
}

export interface Readiness {
  /** 0–100, higher = more recovered */
  score: number;
  band: ReadinessBand;
  /** how many of the three signals actually contributed */
  usedSignals: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

export function readinessBand(score: number): ReadinessBand {
  if (score < READINESS_LOW_BAND) return 'low';
  if (score < READINESS_HIGH_BAND) return 'moderate';
  return 'high';
}

/**
 * Combines the available signals into a readiness score, or null when no
 * signal is present (nothing to score → the coach stays silent).
 */
export function readinessScore(
  input: ReadinessInput,
  baseline: ReadinessBaseline = {}
): Readiness | null {
  const parts: Array<[value: number, weight: number]> = [];

  if (input.hrvMs != null && input.hrvMs > 0) {
    const base = baseline.hrvMs ?? DEFAULT_HRV_BASELINE_MS;
    parts.push([clamp01(input.hrvMs / base), WEIGHT_HRV]);
  }
  if (input.asleepMinutes != null && input.asleepMinutes > 0) {
    parts.push([clamp01(input.asleepMinutes / TARGET_SLEEP_MINUTES), WEIGHT_SLEEP]);
  }
  if (input.restingHr != null && input.restingHr > 0) {
    const base = baseline.restingHr ?? DEFAULT_RESTING_HR_BASELINE;
    parts.push([clamp01(base / input.restingHr), WEIGHT_RESTING_HR]);
  }

  if (parts.length === 0) return null;

  const weightSum = parts.reduce((sum, [, weight]) => sum + weight, 0);
  const weighted = parts.reduce((sum, [value, weight]) => sum + value * weight, 0);
  const score = Math.round((weighted / weightSum) * 100);

  return { score, band: readinessBand(score), usedSignals: parts.length };
}
