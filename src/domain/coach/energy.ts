/**
 * Body level ("Körper-Level") — a Garmin-battery / Whoop-style day gauge.
 * Framework-free. Filled overnight by recovery (the readiness score), drained
 * through the day by accumulated strain. Heuristic, not medical.
 */
import { readinessBand, type ReadinessBand } from './readiness';

/** How many level points a full-strain (100) day drains. */
export const STRAIN_DRAIN_FACTOR = 0.6;

export interface BodyLevel {
  /** 0–100 */
  level: number;
  band: ReadinessBand;
}

/**
 * `morningReadiness` (0–100) is the level the night's sleep topped you up to;
 * `strain` (0–100) is how hard the day has been so far. Returns null when
 * there's no recovery score to start from; missing strain counts as 0 (rested).
 */
export function bodyLevel(
  morningReadiness: number | null,
  strain: number | null
): BodyLevel | null {
  if (morningReadiness == null) return null;
  const drained = morningReadiness - (strain ?? 0) * STRAIN_DRAIN_FACTOR;
  const level = Math.max(0, Math.min(100, Math.round(drained)));
  return { level, band: readinessBand(level) };
}
