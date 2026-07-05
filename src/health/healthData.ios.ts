/**
 * HealthKit adapter — iOS implementation (@kingstinct/react-native-healthkit).
 * Reads what the Apple Watch and the Helio ring (via Zepp → Apple Health)
 * write: sleep analysis, steps, active energy, resting heart rate and HRV.
 *
 * HealthKit needs a native dev build (`npx expo run:ios`). In Expo Go the
 * Nitro native module does not exist and importing the library throws at
 * module scope — so it is loaded lazily here and everything degrades to
 * "unsupported" instead of crashing the whole route.
 */
import Constants, { ExecutionEnvironment } from 'expo-constants';
import { summarizeSleep, type SleepSample } from '@/domain/health';
import type { HealthDay } from '@/domain/healthStats';
import type { HrSample } from '@/domain/coach/strain';
import { EMPTY_DAILY_HEALTH, type DailyHealth } from './types';

type Healthkit = typeof import('@kingstinct/react-native-healthkit');

/** Expo Go has no NitroModules — don't even attempt the require there. */
const IN_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;

let loadAttempted = false;
let hk: Healthkit | null = null;

/** Lazy-require so environments without NitroModules don't crash on import. */
function healthkit(): Healthkit | null {
  if (!loadAttempted) {
    loadAttempted = true;
    if (!IN_EXPO_GO) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-require-imports
        hk = require('@kingstinct/react-native-healthkit') as Healthkit;
      } catch {
        hk = null;
      }
    }
  }
  return hk;
}

const READ_TYPES = [
  'HKCategoryTypeIdentifierSleepAnalysis',
  'HKQuantityTypeIdentifierStepCount',
  'HKQuantityTypeIdentifierActiveEnergyBurned',
  'HKQuantityTypeIdentifierRestingHeartRate',
  'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  'HKQuantityTypeIdentifierHeartRate',
] as const;

export function healthSupported(): boolean {
  try {
    return healthkit()?.isHealthDataAvailable() ?? false;
  } catch {
    return false;
  }
}

/** Shows the iOS permission sheet (no-op if already answered). */
export async function connectHealth(): Promise<boolean> {
  const lib = healthkit();
  if (!lib) return false;
  try {
    return await lib.requestAuthorization({ toRead: [...READ_TYPES] });
  } catch {
    return false;
  }
}

async function sleepFor(dateIso: string): Promise<SleepSample[]> {
  const lib = healthkit();
  if (!lib) return [];
  const dayStart = new Date(`${dateIso}T00:00:00`);
  const nightStart = new Date(dayStart.getTime() - 6 * 3600_000); // 18:00 the day before
  const nightEnd = new Date(dayStart.getTime() + 12 * 3600_000);
  const samples = await lib.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
    limit: 1000,
    ascending: true,
    filter: { date: { startDate: nightStart, endDate: nightEnd } },
  });
  return samples.map((sample) => ({
    start: new Date(sample.startDate).toISOString(),
    end: new Date(sample.endDate).toISOString(),
    value: sample.value as number,
    sourceId: sample.sourceRevision.source.bundleIdentifier,
    sourceName: sample.sourceRevision.source.name,
  }));
}

async function dayStat(
  dateIso: string,
  identifier:
    | 'HKQuantityTypeIdentifierStepCount'
    | 'HKQuantityTypeIdentifierActiveEnergyBurned'
    | 'HKQuantityTypeIdentifierRestingHeartRate'
    | 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
  statistic: 'cumulativeSum' | 'discreteAverage',
  unit: string
): Promise<number | null> {
  const lib = healthkit();
  if (!lib) return null;
  const dayStart = new Date(`${dateIso}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const stats = await lib.queryStatisticsForQuantity(identifier, [statistic], {
    unit,
    filter: { date: { startDate: dayStart, endDate: dayEnd } },
  });
  const quantity =
    statistic === 'cumulativeSum' ? stats.sumQuantity?.quantity : stats.averageQuantity?.quantity;
  return typeof quantity === 'number' && Number.isFinite(quantity) ? quantity : null;
}

async function orNull<T>(promise: Promise<T>): Promise<T | null> {
  try {
    return await promise;
  } catch {
    return null; // type not authorized / no data — treat as absent
  }
}

/** Active energy burned that day (kcal) — feeds the food-tracker target. */
export async function loadActiveKcal(dateIso: string): Promise<number | null> {
  if (!healthSupported()) return null;
  const kcal = await orNull(
    dayStat(dateIso, 'HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', 'kcal')
  );
  return kcal !== null ? Math.round(kcal) : null;
}

export async function loadDailyHealth(dateIso: string): Promise<DailyHealth> {
  if (!healthSupported()) return EMPTY_DAILY_HEALTH;
  const [sleepSamples, steps, activeKcal, restingHr, hrvMs] = await Promise.all([
    orNull(sleepFor(dateIso)),
    orNull(dayStat(dateIso, 'HKQuantityTypeIdentifierStepCount', 'cumulativeSum', 'count')),
    orNull(
      dayStat(dateIso, 'HKQuantityTypeIdentifierActiveEnergyBurned', 'cumulativeSum', 'kcal')
    ),
    orNull(
      dayStat(dateIso, 'HKQuantityTypeIdentifierRestingHeartRate', 'discreteAverage', 'count/min')
    ),
    orNull(
      dayStat(
        dateIso,
        'HKQuantityTypeIdentifierHeartRateVariabilitySDNN',
        'discreteAverage',
        'ms'
      )
    ),
  ]);
  return {
    sleep: sleepSamples ? summarizeSleep(sleepSamples) : null,
    steps: steps !== null ? Math.round(steps) : null,
    activeKcal: activeKcal !== null ? Math.round(activeKcal) : null,
    restingHr: restingHr !== null ? Math.round(restingHr) : null,
    hrvMs: hrvMs !== null ? Math.round(hrvMs) : null,
  };
}

/** Intraday heart-rate samples for a day (strain / body level). */
export async function loadHeartRateSamples(dateIso: string): Promise<HrSample[]> {
  if (!healthSupported()) return [];
  const lib = healthkit();
  if (!lib) return [];
  const dayStart = new Date(`${dateIso}T00:00:00`);
  const dayEnd = new Date(dayStart.getTime() + 24 * 3600_000);
  const samples = await orNull(
    lib.queryQuantitySamples('HKQuantityTypeIdentifierHeartRate', {
      unit: 'count/min',
      limit: 5000,
      ascending: true,
      filter: { date: { startDate: dayStart, endDate: dayEnd } },
    })
  );
  if (!samples) return [];
  return samples.map((sample) => ({
    start: new Date(sample.startDate).toISOString(),
    bpm: sample.quantity,
  }));
}

/** Per-day health metrics for a set of dates — feeds the statistics screen. */
export async function loadHealthRange(dates: string[]): Promise<HealthDay[]> {
  if (!healthSupported()) {
    return dates.map((date) => ({
      date,
      sleepMinutes: null,
      steps: null,
      restingHr: null,
      hrvMs: null,
    }));
  }
  return Promise.all(
    dates.map(async (date) => {
      const daily = await loadDailyHealth(date);
      return {
        date,
        sleepMinutes: daily.sleep ? daily.sleep.asleepMinutes : null,
        steps: daily.steps,
        restingHr: daily.restingHr,
        hrvMs: daily.hrvMs,
      };
    })
  );
}
