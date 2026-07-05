/**
 * Sleep need — recommended sleep for tonight, Bevel style. Framework-free.
 * Baseline need + a share of the recent sleep debt + a strain-based bonus.
 * Heuristic, not medical.
 */

/** Nightly baseline need (minutes). */
export const BASELINE_SLEEP_NEED_MIN = 8 * 60;
/** Share of the accumulated debt to recover in one night. */
export const DEBT_RECOVERY_SHARE = 0.5;
/** Cap on debt added to a single night (minutes). */
export const MAX_DEBT_CARRYOVER_MIN = 120;
/** Extra sleep at maximum strain (minutes). */
export const MAX_STRAIN_BONUS_MIN = 30;

/**
 * Accumulated sleep debt over recent nights: the sum of per-night deficits
 * (baseline − actual, floored at 0). Nights without data are ignored.
 */
export function sleepDebt(
  recentAsleepMinutes: (number | null)[],
  baseline = BASELINE_SLEEP_NEED_MIN
): number {
  return recentAsleepMinutes
    .filter((minutes): minutes is number => minutes != null)
    .reduce((sum, minutes) => sum + Math.max(0, baseline - minutes), 0);
}

/** Recommended sleep for tonight (minutes). */
export function sleepNeed(params: {
  debtMin: number;
  strain: number | null;
  baseline?: number;
}): number {
  const baseline = params.baseline ?? BASELINE_SLEEP_NEED_MIN;
  const debtPart = Math.min(MAX_DEBT_CARRYOVER_MIN, Math.round(params.debtMin * DEBT_RECOVERY_SHARE));
  const strainPart = Math.round(((params.strain ?? 0) / 100) * MAX_STRAIN_BONUS_MIN);
  return baseline + debtPart + strainPart;
}
