/**
 * Training dashboard: week/month/year counters plus a GitHub-style year grid —
 * one dot per day of the year, training days glow in accent color, the rest
 * stays gray. 365 training days = 365 glowing dots.
 */
import { useMemo } from 'react';
import { ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { addDaysIso, isoWeekday } from '@/domain/time';
import { trainingCounts } from '@/domain/trainingStats';

const DOT = 6;
const GAP = 2;

interface Props {
  /** distinct YYYY-MM-DD days with a finished session */
  dates: string[];
}

export function TrainingDashboard({ dates }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const today = format(new Date(), 'yyyy-MM-dd');
  const year = today.slice(0, 4);

  const counts = useMemo(() => trainingCounts(dates, today), [dates, today]);
  const trained = useMemo(() => new Set(dates), [dates]);

  /** weeks-as-columns; the first column is padded to the weekday of Jan 1 */
  const columns = useMemo(() => {
    const days: (string | null)[] = Array(isoWeekday(`${year}-01-01`) - 1).fill(null);
    for (let date = `${year}-01-01`; date.startsWith(year); date = addDaysIso(date, 1)) {
      days.push(date);
    }
    const result: (string | null)[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [year]);

  const accent = uiColor('accent', dark);
  const idle = dark ? '#2c2f3a' : '#e3dcc9';

  const stat = (label: string, value: number) => (
    <View className="flex-1 items-center rounded-xl bg-surface dark:bg-surface-dark py-2.5">
      <Body style={TABULAR} className="text-2xl font-bold text-accent dark:text-accent-dark">
        {value}
      </Body>
      <Muted className="text-xs">{label}</Muted>
    </View>
  );

  return (
    <Card className="mt-4">
      <View className="flex-row items-baseline justify-between">
        <SectionTitle>{t('training.dashboard.title')}</SectionTitle>
        <Muted style={TABULAR}>{year}</Muted>
      </View>
      <View className="mt-3 flex-row gap-2">
        {stat(t('training.dashboard.week'), counts.week)}
        {stat(t('training.dashboard.month'), counts.month)}
        {stat(t('training.dashboard.year'), counts.year)}
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-4">
        <View className="flex-row" style={{ gap: GAP }}>
          {columns.map((week, weekIndex) => (
            <View key={weekIndex} style={{ gap: GAP }}>
              {week.map((date, dayIndex) => {
                if (date === null) {
                  return <View key={dayIndex} style={{ width: DOT, height: DOT }} />;
                }
                const isTrained = trained.has(date);
                const isFuture = date > today;
                return (
                  <View
                    key={dayIndex}
                    style={{
                      width: DOT,
                      height: DOT,
                      borderRadius: DOT / 2,
                      backgroundColor: isTrained ? accent : idle,
                      opacity: isFuture ? 0.35 : 1,
                      ...(isTrained
                        ? {
                            shadowColor: accent,
                            shadowOpacity: 0.9,
                            shadowRadius: 3,
                            shadowOffset: { width: 0, height: 0 },
                            elevation: 3,
                          }
                        : null),
                    }}
                  />
                );
              })}
            </View>
          ))}
        </View>
      </ScrollView>
      <Muted style={TABULAR} className="mt-2 text-xs">
        {t('training.dashboard.legend', { count: counts.year })}
      </Muted>
    </Card>
  );
}
