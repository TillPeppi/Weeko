/**
 * Week-plan statistics: adherence trend across weeks, time budget per block
 * type, skip rates by type and weekday, task completion per category.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Card } from '@/components/ui/Card';
import { Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { uiColor } from '@/constants/uiColors';
import type { Task } from '@/db/schema';
import type { WeekWithBlocks } from '@/db/repos/weekRepo';
import {
  taskCategoryStats,
  typeStats,
  weekdayStats,
  weeklyAdherence,
  type PlanBlock,
} from '@/domain/planStats';
import { BarChart, PercentRow } from './StatBits';

interface Props {
  /** newest first (as returned by listWeeksWithBlocks) */
  weeks: WeekWithBlocks[];
  tasks: Task[];
}

function toPlanBlocks(week: WeekWithBlocks): PlanBlock[] {
  return week.blocks.map(({ date, type, status, start, end }) => ({
    date,
    type,
    status,
    start,
    end,
  }));
}

function formatHours(minutes: number): string {
  const hours = Math.round(minutes / 6) / 10;
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(1);
}

export function PlanStatsSection({ weeks, tasks }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const accent = uiColor('accent', dark);
  const warning = uiColor('warning', dark);
  const emptyColor = dark ? '#2c2f3a' : '#e3dcc9';

  const adherence = useMemo(
    () =>
      weeklyAdherence(
        weeks.map((week) => ({
          year: week.week.year,
          isoWeek: week.week.isoWeek,
          blocks: toPlanBlocks(week),
        }))
      ).slice(-8),
    [weeks]
  );
  const allBlocks = useMemo(() => weeks.flatMap(toPlanBlocks), [weeks]);
  const newestWeek = weeks[0];
  const budget = useMemo(
    () => (newestWeek ? typeStats(toPlanBlocks(newestWeek)) : []),
    [newestWeek]
  );
  const skipByType = useMemo(
    () =>
      typeStats(allBlocks)
        .filter((stat) => stat.skipped > 0)
        .sort((a, b) => b.skippedPercent - a.skippedPercent),
    [allBlocks]
  );
  const byWeekday = useMemo(() => {
    const stats = weekdayStats(allBlocks);
    return Array.from({ length: 7 }, (_, i) => {
      const weekday = i + 1;
      return stats.find((s) => s.weekday === weekday) ?? {
        weekday,
        total: 0,
        skipped: 0,
        skippedPercent: 0,
      };
    });
  }, [allBlocks]);
  const taskStats = useMemo(
    () => taskCategoryStats(tasks.map(({ category, status }) => ({ category, status }))),
    [tasks]
  );

  if (weeks.length === 0 && tasks.length === 0) {
    return (
      <Card className="mt-4">
        <Muted>{t('stats.plan.empty')}</Muted>
      </Card>
    );
  }

  return (
    <View>
      {adherence.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.plan.adherenceTitle')}</SectionTitle>
          <View className="mt-3">
            <BarChart
              emptyColor={emptyColor}
              bars={adherence.map((week, index) => ({
                key: `${week.year}-${week.isoWeek}`,
                label: t('stats.weekShort', { week: week.isoWeek }),
                value: week.donePercent,
                valueLabel: week.total > 0 ? `${week.donePercent}%` : '',
                color: index === adherence.length - 1 ? accent : `${accent}99`,
                highlighted: index === adherence.length - 1,
              }))}
            />
          </View>
          <Muted className="mt-2 text-xs">{t('stats.plan.adherenceLegend')}</Muted>
        </Card>
      )}

      {newestWeek && budget.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>
            {t('stats.plan.timeBudgetTitle', { week: newestWeek.week.isoWeek })}
          </SectionTitle>
          <View className="mt-3 gap-3">
            {budget.map((stat) => {
              const palette = BLOCK_COLORS[stat.type];
              return (
                <PercentRow
                  key={stat.type}
                  label={t(`blockTypes.${stat.type}`)}
                  valueLabel={t('stats.plan.timeBudgetValue', {
                    done: formatHours(stat.doneMinutes),
                    planned: formatHours(stat.plannedMinutes),
                  })}
                  percent={
                    stat.plannedMinutes > 0
                      ? (stat.doneMinutes / stat.plannedMinutes) * 100
                      : 0
                  }
                  color={dark ? palette.hexDark : palette.hex}
                />
              );
            })}
          </View>
          <Muted className="mt-2 text-xs">{t('stats.plan.timeBudgetLegend')}</Muted>
        </Card>
      )}

      {skipByType.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.plan.skipTitle')}</SectionTitle>
          <View className="mt-3 gap-3">
            {skipByType.map((stat) => (
              <PercentRow
                key={stat.type}
                label={t(`blockTypes.${stat.type}`)}
                valueLabel={t('stats.plan.skipValue', {
                  skipped: stat.skipped,
                  total: stat.total,
                  percent: stat.skippedPercent,
                })}
                percent={stat.skippedPercent}
                color={warning}
              />
            ))}
          </View>
        </Card>
      )}

      {allBlocks.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.plan.weekdayTitle')}</SectionTitle>
          <View className="mt-3">
            <BarChart
              emptyColor={emptyColor}
              bars={byWeekday.map((stat) => ({
                key: String(stat.weekday),
                label: t(`weekdaysShort.${stat.weekday}`),
                value: stat.skippedPercent,
                valueLabel: stat.total > 0 ? `${stat.skippedPercent}%` : '',
                color: warning,
              }))}
            />
          </View>
          <Muted className="mt-2 text-xs">{t('stats.plan.weekdayLegend')}</Muted>
        </Card>
      )}

      {taskStats.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.plan.tasksTitle')}</SectionTitle>
          <View className="mt-3 gap-3">
            {taskStats.map((stat) => (
              <PercentRow
                key={stat.category}
                label={t(`tasks.categories.${stat.category}`, { defaultValue: stat.category })}
                valueLabel={t('stats.plan.tasksValue', { done: stat.done, total: stat.total })}
                percent={stat.donePercent}
                color={stat.donePercent >= 100 ? uiColor('success', dark) : accent}
              />
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}
