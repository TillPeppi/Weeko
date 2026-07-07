/**
 * View mode for time-series statistics charts: chart type (bar/line) and the
 * aggregation period (per day, weekly average, monthly average). Framework-free
 * so the domain aggregator and the UI can share it.
 */
export type ChartType = 'bar' | 'line';
export type StatsPeriod = 'day' | 'week' | 'month';

export interface StatsMode {
  type: ChartType;
  period: StatsPeriod;
}

export const DEFAULT_STATS_MODE: StatsMode = { type: 'bar', period: 'week' };
