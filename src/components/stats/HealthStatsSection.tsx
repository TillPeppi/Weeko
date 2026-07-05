/**
 * Health statistics (Apple Health, iOS only): 7-day averages for sleep,
 * steps, resting HR and HRV plus a per-night sleep chart. On platforms
 * without HealthKit the section degrades to a hint.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle } from '@/components/ui/Text';
import { uiColor, type UI_COLORS } from '@/constants/uiColors';
import { healthAverages, type HealthDay } from '@/domain/healthStats';
import { isoWeekday } from '@/domain/time';
import type { ReadinessBand } from '@/domain/coach/readiness';
import { averageReadiness, readinessSeries } from '@/domain/coach/readinessHistory';
import { useCoachStore } from '@/stores/coachStore';
import { BarChart, StatTile } from './StatBits';
import { dateFnsLocale } from '@/i18n';

/** Readiness band → palette token (mirrors the HealthCard badge). */
const BAND_COLOR: Record<ReadinessBand, keyof typeof UI_COLORS> = {
  low: 'danger',
  moderate: 'warning',
  high: 'success',
};

interface Props {
  supported: boolean;
  /** last 7 days, oldest first */
  days: HealthDay[];
}

function formatSleep(minutes: number | null): string {
  if (minutes === null) return '–';
  const h = Math.floor(minutes / 60);
  const m = String(minutes % 60).padStart(2, '0');
  return `${h}:${m}`;
}

export function HealthStatsSection({ supported, days }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const accent = uiColor('accent', dark);
  const emptyColor = dark ? '#2c2f3a' : '#e3dcc9';

  const baseline = useCoachStore((s) => s.baseline);
  const averages = useMemo(() => healthAverages(days), [days]);
  const readiness = useMemo(() => readinessSeries(days, baseline), [days, baseline]);
  const avgReadiness = useMemo(() => averageReadiness(readiness), [readiness]);

  if (!supported) {
    return (
      <Card className="mt-4">
        <Muted>{t('health.webUnsupported')}</Muted>
      </Card>
    );
  }

  if (averages.daysWithData === 0) {
    return (
      <Card className="mt-4">
        <Muted>{t('stats.health.noData')}</Muted>
      </Card>
    );
  }

  return (
    <View>
      <Card className="mt-4">
        <View className="flex-row flex-wrap gap-2">
          <StatTile
            value={formatSleep(averages.sleepMinutes)}
            label={t('stats.health.avgSleep')}
            sub="h"
          />
          <StatTile
            value={averages.steps !== null ? averages.steps.toLocaleString() : '–'}
            label={t('stats.health.avgSteps')}
          />
          <StatTile
            value={averages.restingHr !== null ? String(averages.restingHr) : '–'}
            label={t('stats.health.avgRestingHr')}
            sub="bpm"
          />
          <StatTile
            value={averages.hrvMs !== null ? String(averages.hrvMs) : '–'}
            label={t('stats.health.avgHrv')}
            sub="ms"
          />
        </View>
        <Muted className="mt-2 text-xs">
          {t('stats.health.daysWithData', { count: averages.daysWithData, total: days.length })}
        </Muted>
      </Card>

      {avgReadiness !== null && (
        <Card className="mt-4">
          <View className="flex-row items-center justify-between">
            <SectionTitle>{t('stats.health.readinessTitle')}</SectionTitle>
            <View className="flex-row items-baseline gap-1.5">
              <Muted className="text-[10px] font-bold uppercase tracking-wider">
                {t('stats.health.avgReadiness')}
              </Muted>
              <Body className="text-xl font-extrabold text-accent dark:text-accent-dark">
                {avgReadiness}
              </Body>
            </View>
          </View>
          <View className="mt-3">
            <BarChart
              emptyColor={emptyColor}
              bars={readiness.map((point) => ({
                key: point.date,
                label: t(`weekdaysShort.${isoWeekday(point.date)}`),
                value: point.readiness?.score ?? 0,
                valueLabel: point.readiness ? String(point.readiness.score) : '',
                color: point.readiness ? uiColor(BAND_COLOR[point.readiness.band], dark) : emptyColor,
                highlighted: point === readiness[readiness.length - 1],
              }))}
            />
          </View>
          <Muted className="mt-2 text-xs">{t('stats.health.readinessLegend')}</Muted>
        </Card>
      )}

      <Card className="mt-4">
        <SectionTitle>{t('stats.health.sleepTitle')}</SectionTitle>
        <View className="mt-3">
          <BarChart
            emptyColor={emptyColor}
            bars={days.map((day) => ({
              key: day.date,
              label: t(`weekdaysShort.${isoWeekday(day.date)}`),
              value: day.sleepMinutes ?? 0,
              valueLabel: day.sleepMinutes !== null ? formatSleep(day.sleepMinutes) : '',
              color: accent,
              highlighted: day === days[days.length - 1],
            }))}
          />
        </View>
        <Muted className="mt-2 text-xs">
          {t('stats.health.sleepLegend', {
            from: format(parseISO(days[0].date), 'd. MMM', { locale: dateFnsLocale() }),
          })}
        </Muted>
      </Card>

      {averages.hrvMs !== null && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.health.hrvTitle')}</SectionTitle>
          <View className="mt-3">
            <BarChart
              emptyColor={emptyColor}
              bars={days.map((day) => ({
                key: day.date,
                label: t(`weekdaysShort.${isoWeekday(day.date)}`),
                value: day.hrvMs ?? 0,
                valueLabel: day.hrvMs !== null ? String(day.hrvMs) : '',
                color: uiColor('success', dark),
                highlighted: day === days[days.length - 1],
              }))}
            />
          </View>
          <Muted className="mt-2 text-xs">{t('stats.health.hrvLegend')}</Muted>
        </Card>
      )}
    </View>
  );
}
