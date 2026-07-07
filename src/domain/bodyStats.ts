import { BodyMeasurement } from '@/db/schema';
import { subDays, formatISO } from 'date-fns';

export interface WeightTrend {
  weightKg: number;
  change: number; // kg difference from previous
  changePercent: number; // % difference
  date: string; // YYYY-MM-DD
  fatPercent: number | null;
}

export interface BodyStats {
  current?: {
    weightKg: number;
    fatPercent: number | null;
    muscleMassKg: number | null;
    boneMassKg: number | null;
    bmrKcal: number | null;
    date: string;
  };
  trend: WeightTrend[]; // last 30 days, ascending
  averageWeight30d: number;
  trend30dChange: number; // kg from 30d ago to today
  trend30dChangePercent: number;
  monthlyAverage?: number; // current month
}

export function bodyStatsFrom(measurements: BodyMeasurement[]): BodyStats {
  if (!measurements.length) {
    return {
      trend: [],
      averageWeight30d: 0,
      trend30dChange: 0,
      trend30dChangePercent: 0,
    };
  }

  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  const current = sorted[sorted.length - 1];

  // Last 30 days
  const thirtyDaysAgo = subDays(new Date(current.date), 29);
  const last30 = sorted.filter((m) => new Date(m.date) >= thirtyDaysAgo);

  // Trend with change
  const trend: WeightTrend[] = last30.map((m, i) => {
    const prev = i > 0 ? last30[i - 1] : null;
    const change = prev ? m.weightKg - prev.weightKg : 0;
    const changePercent = prev ? (change / prev.weightKg) * 100 : 0;

    return {
      weightKg: m.weightKg,
      fatPercent: m.fatPercent,
      date: m.date,
      change,
      changePercent,
    };
  });

  // 30-day stats
  const avg30 = last30.length > 0 ? last30.reduce((sum, m) => sum + m.weightKg, 0) / last30.length : 0;
  const oldest30 = last30[0];
  const trend30Change = current.weightKg - oldest30.weightKg;
  const trend30ChangePercent = oldest30.weightKg > 0 ? (trend30Change / oldest30.weightKg) * 100 : 0;

  // Current month average
  const today = new Date(current.date);
  const monthStart = new Date(today.getFullYear(), today.getMonth(), 1);
  const currentMonth = sorted.filter((m) => new Date(m.date) >= monthStart);
  const monthAvg =
    currentMonth.length > 0 ? currentMonth.reduce((sum, m) => sum + m.weightKg, 0) / currentMonth.length : undefined;

  return {
    current: {
      weightKg: current.weightKg,
      fatPercent: current.fatPercent,
      muscleMassKg: current.muscleMassKg,
      boneMassKg: current.boneMassKg,
      bmrKcal: current.bmrKcal,
      date: current.date,
    },
    trend,
    averageWeight30d: avg30,
    trend30dChange: trend30Change,
    trend30dChangePercent: trend30ChangePercent,
    monthlyAverage: monthAvg,
  };
}

export type BodyMetricKey = 'weight' | 'fat' | 'muscle' | 'bone' | 'bmr';

export interface BodyMetricPoint {
  date: string; // YYYY-MM-DD
  value: number;
}

export interface BodyMetricSeries {
  key: BodyMetricKey;
  unit: 'kg' | '%' | 'kcal';
  /** ascending by date, only entries where the metric was recorded */
  points: BodyMetricPoint[];
  current: number | null;
  first: number | null;
  /** current − first (progress over the recorded span); null if < 1 point */
  change: number | null;
}

const METRIC_DEFS: { key: BodyMetricKey; unit: 'kg' | '%' | 'kcal'; pick: (m: BodyMeasurement) => number | null }[] = [
  { key: 'weight', unit: 'kg', pick: (m) => m.weightKg },
  { key: 'fat', unit: '%', pick: (m) => m.fatPercent },
  { key: 'muscle', unit: 'kg', pick: (m) => m.muscleMassKg },
  { key: 'bone', unit: 'kg', pick: (m) => m.boneMassKg },
  { key: 'bmr', unit: 'kcal', pick: (m) => m.bmrKcal },
];

/**
 * One time series per body metric, for charting. Metrics with no recorded
 * values yield an empty `points` array (callers can skip them).
 */
export function bodyMetricSeries(measurements: BodyMeasurement[]): BodyMetricSeries[] {
  const sorted = [...measurements].sort((a, b) => a.date.localeCompare(b.date));
  return METRIC_DEFS.map(({ key, unit, pick }) => {
    const points: BodyMetricPoint[] = [];
    for (const m of sorted) {
      const value = pick(m);
      if (value != null) points.push({ date: m.date, value });
    }
    const first = points.length ? points[0].value : null;
    const current = points.length ? points[points.length - 1].value : null;
    return {
      key,
      unit,
      points,
      first,
      current,
      change: first != null && current != null ? current - first : null,
    };
  });
}

/** Body-Mass-Index from weight (kg) and height (cm); null if height is missing/invalid. */
export function bmiFrom(weightKg: number, heightCm: number | null | undefined): number | null {
  if (!heightCm || heightCm <= 0) return null;
  const m = heightCm / 100;
  return weightKg / (m * m);
}

/** WHO weight-status band for a BMI value. */
export function bmiCategory(bmi: number): 'underweight' | 'normal' | 'overweight' | 'obese' {
  if (bmi < 18.5) return 'underweight';
  if (bmi < 25) return 'normal';
  if (bmi < 30) return 'overweight';
  return 'obese';
}

export function formatWeightChange(changeKg: number, changePercent: number): string {
  const sign = changeKg > 0 ? '+' : '';
  const percentSign = changePercent > 0 ? '+' : '';
  return `${sign}${changeKg.toFixed(1)} kg (${percentSign}${changePercent.toFixed(1)}%)`;
}
