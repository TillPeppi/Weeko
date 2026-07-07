/**
 * Buckets a sparse daily series (one value per day, gaps allowed) into the
 * chosen period, averaging the day-values inside each bucket. "Weekly average"
 * / "monthly average" therefore mean the mean of the recorded days — days with
 * no data never count as zero. Framework-free.
 */
import { isoWeekOf, mondayOfWeek } from './time';
import type { StatsPeriod } from './statsMode';

export interface DayValue {
  /** YYYY-MM-DD */
  date: string;
  value: number;
}

export interface SeriesBucket {
  /** stable identity for React keys */
  key: string;
  /** representative date (YYYY-MM-DD) the caller formats into a label */
  from: string;
  /** mean of the day-values in this bucket */
  value: number;
  /** how many days were averaged */
  count: number;
}

export function aggregateSeries(days: DayValue[], period: StatsPeriod): SeriesBucket[] {
  const sorted = [...days].sort((a, b) => a.date.localeCompare(b.date));
  if (period === 'day') {
    return sorted.map((d) => ({ key: d.date, from: d.date, value: d.value, count: 1 }));
  }
  const groups = new Map<string, { from: string; sum: number; count: number }>();
  for (const d of sorted) {
    let key: string;
    let from: string;
    if (period === 'week') {
      from = mondayOfWeek(d.date);
      const { year, isoWeek } = isoWeekOf(d.date);
      key = `${year}-W${isoWeek}`;
    } else {
      key = d.date.slice(0, 7); // YYYY-MM
      from = `${key}-01`;
    }
    const existing = groups.get(key);
    if (existing) {
      existing.sum += d.value;
      existing.count += 1;
    } else {
      groups.set(key, { from, sum: d.value, count: 1 });
    }
  }
  // Map keeps insertion order; input was sorted ascending, so buckets are too.
  return [...groups.entries()].map(([key, g]) => ({
    key,
    from: g.from,
    value: g.sum / g.count,
    count: g.count,
  }));
}
