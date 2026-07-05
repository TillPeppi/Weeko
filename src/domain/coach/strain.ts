/**
 * Strain — the day's cardiovascular load, Whoop/Bevel style, from heart-rate
 * samples. Framework-free: the HealthKit adapter delivers the samples, this
 * module turns time-in-HR-zones into a 0–100 strain score.
 *
 * The zone weights and scale are heuristics (no clinical claim) and need
 * calibration against real device data — they live as exported constants.
 */

export interface HrSample {
  /** ISO timestamp */
  start: string;
  /** beats per minute */
  bpm: number;
}

/** Five zones as fractions of max HR (Z1 ≥ .5 … Z5 ≥ .9); below .5 = rest. */
export const HR_ZONE_LOWER_FRACTIONS = [0.5, 0.6, 0.7, 0.8, 0.9] as const;
/** Metabolic-ish weight per zone (Z1…Z5). */
export const HR_ZONE_WEIGHTS = [1, 2, 4, 6, 9] as const;
/** Scale for the saturating strain curve (higher = harder to reach 100). */
export const STRAIN_SCALE = 450;
/** Cap on the gap counted between two samples (min) — avoids overcounting sparse data. */
export const MAX_SAMPLE_GAP_MIN = 5;

export interface StrainResult {
  /** 0–100 */
  score: number;
  /** minutes spent in each of the 5 zones (Z1…Z5) */
  zoneMinutes: number[];
  /** total minutes above rest */
  activeMinutes: number;
}

/** 220 − age; falls back to 190 when age is unknown. */
export function estimateMaxHr(age: number | null | undefined): number {
  return age && age > 0 ? 220 - age : 190;
}

/** Zone index 0 (rest) … 5 for a bpm relative to max HR. */
function zoneOf(bpm: number, maxHr: number): number {
  const frac = bpm / maxHr;
  let zone = 0;
  for (let i = 0; i < HR_ZONE_LOWER_FRACTIONS.length; i += 1) {
    if (frac >= HR_ZONE_LOWER_FRACTIONS[i]) zone = i + 1;
  }
  return zone;
}

/** Minutes per zone (Z1…Z5); each sample covers the gap until the next one. */
export function timeInZones(samples: HrSample[], maxHr: number): number[] {
  const zoneMinutes = [0, 0, 0, 0, 0];
  const sorted = [...samples].sort((a, b) => a.start.localeCompare(b.start));
  for (let i = 0; i < sorted.length - 1; i += 1) {
    const gapMin = (Date.parse(sorted[i + 1].start) - Date.parse(sorted[i].start)) / 60000;
    if (!Number.isFinite(gapMin) || gapMin <= 0) continue;
    const minutes = Math.min(gapMin, MAX_SAMPLE_GAP_MIN);
    const zone = zoneOf(sorted[i].bpm, maxHr);
    if (zone >= 1) zoneMinutes[zone - 1] += minutes;
  }
  return zoneMinutes;
}

/** Weighted, saturating 0–100 score from zone minutes. */
export function strainScore(zoneMinutes: number[]): number {
  const raw = zoneMinutes.reduce((sum, minutes, i) => sum + minutes * HR_ZONE_WEIGHTS[i], 0);
  return Math.round(100 * (1 - Math.exp(-raw / STRAIN_SCALE)));
}

/** Full strain from raw HR samples; null when there is nothing to score. */
export function strainFromSamples(samples: HrSample[], maxHr: number): StrainResult | null {
  if (samples.length < 2) return null;
  const zoneMinutes = timeInZones(samples, maxHr);
  const activeMinutes = Math.round(zoneMinutes.reduce((sum, m) => sum + m, 0));
  if (activeMinutes === 0) return { score: 0, zoneMinutes, activeMinutes: 0 };
  return { score: strainScore(zoneMinutes), zoneMinutes, activeMinutes };
}
