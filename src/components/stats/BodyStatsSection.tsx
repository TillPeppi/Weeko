/**
 * Body-composition trends: one card per recorded metric (weight, body fat,
 * muscle mass, bone mass, basal rate) with the current value, the change since
 * the first entry and a min–max-zoomed sparkline. Shared by the Stats screen
 * (Körper tab) and the Body-data screen so both show the same graphics.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor, type UI_COLORS } from '@/constants/uiColors';
import { bodyMetricSeries, type BodyMetricKey, type BodyMetricSeries } from '@/domain/bodyStats';
import { Sparkline } from './StatBits';
import { dateFnsLocale } from '@/i18n';
import type { BodyMeasurement } from '@/db/schema';

const METRIC_COLOR: Record<BodyMetricKey, keyof typeof UI_COLORS> = {
  weight: 'accent',
  fat: 'warning',
  muscle: 'success',
  bone: 'muted',
  bmr: 'accent',
};

const METRIC_LABEL: Record<BodyMetricKey, string> = {
  weight: 'bodyLog.weight',
  fat: 'bodyLog.fat',
  muscle: 'bodyLog.muscle',
  bone: 'bodyLog.bone',
  bmr: 'bodyLog.bmr',
};

function formatValue(value: number, unit: BodyMetricSeries['unit']): string {
  if (unit === '%') return `${value.toFixed(1)} %`;
  if (unit === 'kcal') return `${Math.round(value)} kcal`;
  return `${value.toFixed(1)} kg`;
}

function formatDelta(change: number, unit: BodyMetricSeries['unit']): string {
  const sign = change > 0 ? '+' : '';
  if (unit === 'kcal') return `${sign}${Math.round(change)} kcal`;
  return `${sign}${change.toFixed(1)} ${unit === '%' ? '%' : 'kg'}`;
}

export function BodyStatsSection({ measurements }: { measurements: BodyMeasurement[] }) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  const series = useMemo(() => bodyMetricSeries(measurements), [measurements]);
  const active = series.filter((s) => s.points.length > 0);

  if (active.length === 0) {
    return (
      <Card className="mt-4">
        <Muted>{t('stats.body.empty')}</Muted>
      </Card>
    );
  }

  return (
    <View>
      {active.map((s) => {
        const color = uiColor(METRIC_COLOR[s.key], dark);
        const from = s.points[0].date;
        return (
          <Card key={s.key} className="mt-4">
            <View className="flex-row items-start justify-between">
              <View className="flex-1 pr-3">
                <SectionTitle>{t(METRIC_LABEL[s.key])}</SectionTitle>
                <Muted className="text-xs">
                  {t('stats.body.points', {
                    count: s.points.length,
                    from: format(parseISO(from), 'd. MMM', { locale: dateFnsLocale() }),
                  })}
                </Muted>
              </View>
              <View className="items-end">
                <Body style={TABULAR} className="text-xl font-extrabold">
                  {s.current != null ? formatValue(s.current, s.unit) : '–'}
                </Body>
                {s.change != null && s.points.length > 1 ? (
                  <Muted style={TABULAR} className="text-xs">
                    {formatDelta(s.change, s.unit)}
                  </Muted>
                ) : null}
              </View>
            </View>
            {s.points.length > 1 ? (
              <View className="mt-3">
                <Sparkline values={s.points.map((p) => p.value)} color={color} />
              </View>
            ) : (
              <Muted className="mt-2 text-xs">{t('stats.body.needMore')}</Muted>
            )}
          </Card>
        );
      })}
    </View>
  );
}
