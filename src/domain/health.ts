/**
 * Health domain logic: summarize a night of HealthKit sleep samples.
 * Framework-free — the HealthKit adapter lives in src/health/.
 *
 * Apple Watch AND a sleep ring (e.g. Helio via Zepp) often both write sleep
 * for the same night. Summing everything would double-count, so the summary
 * picks the source with the most recorded asleep time.
 */

/** Apple HKCategoryValueSleepAnalysis raw values. */
export const SLEEP_VALUE = {
  inBed: 0,
  asleepUnspecified: 1,
  awake: 2,
  asleepCore: 3,
  asleepDeep: 4,
  asleepREM: 5,
} as const;

export interface SleepSample {
  /** ISO timestamps */
  start: string;
  end: string;
  /** HKCategoryValueSleepAnalysis raw value */
  value: number;
  /** source app/device bundle id — used to avoid double counting */
  sourceId: string;
  sourceName?: string;
}

export interface SleepStages {
  /** core + unspecified sleep */
  coreMinutes: number;
  deepMinutes: number;
  remMinutes: number;
  awakeMinutes: number;
}

export interface SleepSummary extends SleepStages {
  /** total time asleep (core + deep + rem) */
  asleepMinutes: number;
  inBedMinutes: number;
  /** ISO timestamps of first falling asleep / final wake-up */
  bedtime: string | null;
  wakeTime: string | null;
  sourceName: string | null;
}

const ASLEEP_VALUES: number[] = [
  SLEEP_VALUE.asleepUnspecified,
  SLEEP_VALUE.asleepCore,
  SLEEP_VALUE.asleepDeep,
  SLEEP_VALUE.asleepREM,
];

function minutes(sample: SleepSample): number {
  return Math.max(0, (Date.parse(sample.end) - Date.parse(sample.start)) / 60000);
}

/** Summarizes one night; null when there is no usable sleep data. */
export function summarizeSleep(samples: SleepSample[]): SleepSummary | null {
  if (samples.length === 0) return null;

  // pick the source that recorded the most asleep time (fallback: in-bed time)
  const bySource = new Map<string, SleepSample[]>();
  for (const sample of samples) {
    const list = bySource.get(sample.sourceId) ?? [];
    list.push(sample);
    bySource.set(sample.sourceId, list);
  }
  let best: SleepSample[] = [];
  let bestScore = -1;
  for (const list of bySource.values()) {
    const score =
      list
        .filter((s) => ASLEEP_VALUES.includes(s.value))
        .reduce((sum, s) => sum + minutes(s), 0) *
        10 +
      list.reduce((sum, s) => sum + minutes(s), 0);
    if (score > bestScore) {
      bestScore = score;
      best = list;
    }
  }

  const stage = (values: number[]) =>
    Math.round(
      best.filter((s) => values.includes(s.value)).reduce((sum, s) => sum + minutes(s), 0)
    );

  const coreMinutes = stage([SLEEP_VALUE.asleepCore, SLEEP_VALUE.asleepUnspecified]);
  const deepMinutes = stage([SLEEP_VALUE.asleepDeep]);
  const remMinutes = stage([SLEEP_VALUE.asleepREM]);
  const asleepMinutes = coreMinutes + deepMinutes + remMinutes;
  const inBedMinutes = stage([SLEEP_VALUE.inBed]);
  if (asleepMinutes === 0 && inBedMinutes === 0) return null;

  const rest = best.filter(
    (s) => ASLEEP_VALUES.includes(s.value) || s.value === SLEEP_VALUE.inBed
  );
  const bedtime = rest.length
    ? rest.reduce((min, s) => (s.start < min ? s.start : min), rest[0].start)
    : null;
  const wakeTime = rest.length
    ? rest.reduce((max, s) => (s.end > max ? s.end : max), rest[0].end)
    : null;

  return {
    asleepMinutes,
    coreMinutes,
    deepMinutes,
    remMinutes,
    awakeMinutes: stage([SLEEP_VALUE.awake]),
    inBedMinutes,
    bedtime,
    wakeTime,
    sourceName: best[0]?.sourceName ?? null,
  };
}
