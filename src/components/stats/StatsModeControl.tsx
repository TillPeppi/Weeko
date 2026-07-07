/**
 * Global controls for time-series stats: chart type (bar/line) and aggregation
 * period (daily / weekly avg / monthly avg). Used at the top of the Stats screen
 * and mirrored on the Body-data screen. `useBucketLabel` turns an aggregated
 * bucket's representative date into a period-appropriate axis label.
 */
import { useCallback } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { format, parseISO } from 'date-fns';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { isoWeekOf } from '@/domain/time';
import { dateFnsLocale } from '@/i18n';
import type { ChartType, StatsMode, StatsPeriod } from '@/domain/statsMode';

export function StatsModeControl({
  mode,
  onChange,
}: {
  mode: StatsMode;
  onChange: (mode: StatsMode) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="mt-3 gap-2">
      <SegmentedControl<ChartType>
        options={[
          { value: 'bar', label: t('stats.mode.bar') },
          { value: 'line', label: t('stats.mode.line') },
        ]}
        value={mode.type}
        onChange={(type) => onChange({ ...mode, type })}
      />
      <SegmentedControl<StatsPeriod>
        options={[
          { value: 'day', label: t('stats.mode.daily') },
          { value: 'week', label: t('stats.mode.weekly') },
          { value: 'month', label: t('stats.mode.monthly') },
        ]}
        value={mode.period}
        onChange={(period) => onChange({ ...mode, period })}
      />
    </View>
  );
}

/** Returns a formatter for aggregated-bucket labels appropriate to the period. */
export function useBucketLabel(period: StatsPeriod): (from: string) => string {
  const { t } = useTranslation();
  return useCallback(
    (from: string) => {
      const date = parseISO(from);
      if (period === 'day') return format(date, 'd.M.', { locale: dateFnsLocale() });
      if (period === 'month') return format(date, 'MMM', { locale: dateFnsLocale() });
      return t('stats.weekShort', { week: isoWeekOf(from).isoWeek });
    },
    [period, t]
  );
}
