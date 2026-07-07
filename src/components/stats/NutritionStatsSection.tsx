/**
 * Nutrition statistics: weekly kcal balance vs. the lean-gain target,
 * macro weekly averages, meal distribution, top foods and micro trend.
 */
import { useMemo } from 'react';
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import type { FoodEntry } from '@/db/schema';
import { MICRO_KEYS, type MicroKey, type NutrientTargets } from '@/domain/nutrition';
import {
  dailyNutrition,
  kcalBalance,
  mealDistribution,
  topFoods,
  weeklyMicros,
  weeklyNutrition,
} from '@/domain/nutritionStats';
import { aggregateSeries } from '@/domain/seriesAggregate';
import { DEFAULT_STATS_MODE, type StatsMode } from '@/domain/statsMode';
import { mondayOfWeek } from '@/domain/time';
import { PercentRow, StatTile, TrendChart } from './StatBits';
import { useBucketLabel } from './StatsModeControl';

const MEAL_ORDER = ['breakfast', 'lunch', 'dinner', 'snack'];

interface Props {
  /** entries of the loaded stats range (last 28 days) */
  entries: FoodEntry[];
  targets: NutrientTargets;
  today: string;
  mode?: StatsMode;
}

function signed(value: number): string {
  return `${value > 0 ? '+' : ''}${value}`;
}

export function NutritionStatsSection({ entries, targets, today, mode = DEFAULT_STATS_MODE }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const accent = uiColor('accent', dark);
  const emptyColor = dark ? '#2c2f3a' : '#e3dcc9';
  const bucketLabel = useBucketLabel(mode.period);

  const weekly = useMemo(() => weeklyNutrition(entries, today, 4), [entries, today]);
  const kcalBuckets = useMemo(
    () => aggregateSeries(dailyNutrition(entries).map((d) => ({ date: d.date, value: d.kcal })), mode.period),
    [entries, mode.period]
  );
  const balance = useMemo(() => {
    const monday = mondayOfWeek(today);
    return kcalBalance(entries.filter((e) => e.date >= monday && e.date <= today), targets.kcal);
  }, [entries, targets.kcal, today]);
  const meals = useMemo(() => {
    const result = mealDistribution(entries);
    return MEAL_ORDER.map((meal) => result.find((m) => m.meal === meal)).filter(
      (m): m is NonNullable<typeof m> => m !== undefined
    );
  }, [entries]);
  const top = useMemo(() => topFoods(entries, 5), [entries]);
  // latest week that has data — feeds the full macro breakdown
  const latestWeek = useMemo(
    () => [...weekly].reverse().find((week) => week.trackedDays > 0),
    [weekly]
  );
  const microRows = useMemo(() => {
    const weeks = weeklyMicros(entries, today, 4);
    const rows: { key: MicroKey; percents: (number | null)[]; avg: number }[] = [];
    for (const key of MICRO_KEYS) {
      const percents = weeks.map((week) => week.percentByMicro[key] ?? null);
      const present = percents.filter((p): p is number => p !== null);
      if (present.length === 0) continue;
      rows.push({
        key,
        percents,
        avg: Math.round(present.reduce((sum, p) => sum + p, 0) / present.length),
      });
    }
    return rows.sort((a, b) => a.avg - b.avg).slice(0, 6);
  }, [entries, today]);

  if (entries.length === 0) {
    return (
      <Card className="mt-4">
        <Muted>{t('stats.food.empty')}</Muted>
      </Card>
    );
  }

  const balanceWord = balance.surplusKcal >= 0 ? t('stats.food.surplus') : t('stats.food.deficit');
  const balanceColor =
    balance.surplusKcal >= 0
      ? 'text-success dark:text-success-dark'
      : 'text-warning dark:text-warning-dark';

  return (
    <View>
      <Card elevated className="mt-4">
        <SectionTitle>{t('stats.food.balanceTitle')}</SectionTitle>
        {balance.trackedDays === 0 ? (
          <Muted className="mt-2">{t('stats.food.balanceEmpty')}</Muted>
        ) : (
          <>
            <View className="mt-2 flex-row items-baseline gap-2">
              <Body style={TABULAR} className={`text-2xl font-bold ${balanceColor}`}>
                {signed(balance.surplusKcal)} kcal
              </Body>
              <Body className="font-semibold">{balanceWord}</Body>
            </View>
            <Muted style={TABULAR} className="mt-1">
              {t('stats.food.balanceEstimate', { kg: signed(balance.estimatedKg) })}
            </Muted>
            <Muted style={TABULAR} className="mt-0.5 text-xs">
              {t('stats.food.balanceDays', {
                count: balance.trackedDays,
                target: targets.kcal,
              })}
            </Muted>
          </>
        )}
      </Card>

      <Card className="mt-4">
        <SectionTitle>{t('stats.food.kcalWeeklyTitle')}</SectionTitle>
        <View className="mt-3">
          <TrendChart
            type={mode.type}
            emptyColor={emptyColor}
            color={accent}
            bars={kcalBuckets.map((bucket, index) => {
              const value = Math.round(bucket.value);
              return {
                key: bucket.key,
                label: bucketLabel(bucket.from),
                value,
                valueLabel: value > 0 ? String(value) : '',
                color:
                  value > targets.kcal * 1.1
                    ? uiColor('warning', dark)
                    : index === kcalBuckets.length - 1
                      ? accent
                      : `${accent}99`,
                highlighted: index === kcalBuckets.length - 1,
              };
            })}
          />
        </View>
        <Muted style={TABULAR} className="mt-2 text-xs">
          {t('stats.food.kcalWeeklyLegend', { target: targets.kcal })}
        </Muted>
        <View className="mt-4 gap-3">
          {weekly
            .filter((week) => week.trackedDays > 0)
            .map((week) => (
              <PercentRow
                key={`protein-${week.year}-${week.isoWeek}`}
                label={t('stats.food.proteinWeekRow', {
                  week: week.isoWeek,
                  days: week.trackedDays,
                })}
                valueLabel={`Ø ${week.avgProtein} / ${targets.proteinMin} g`}
                percent={(week.avgProtein / targets.proteinMin) * 100}
                color={
                  week.avgProtein >= targets.proteinMin
                    ? uiColor('success', dark)
                    : accent
                }
              />
            ))}
        </View>
        <Muted className="mt-2 text-xs">{t('stats.food.proteinLegend')}</Muted>
      </Card>

      {latestWeek && (
        <Card className="mt-4">
          <SectionTitle>
            {t('stats.food.macroTitle', { week: latestWeek.isoWeek })}
          </SectionTitle>
          <View className="mt-3 gap-3">
            <PercentRow
              label={t('food.nutrients.carbs')}
              valueLabel={`Ø ${latestWeek.avgCarbs} / ${targets.carbsRef} g`}
              percent={(latestWeek.avgCarbs / targets.carbsRef) * 100}
              color={accent}
            />
            <PercentRow
              label={t('food.nutrients.fat')}
              valueLabel={`Ø ${latestWeek.avgFat} / ${targets.fatRef} g`}
              percent={(latestWeek.avgFat / targets.fatRef) * 100}
              color={accent}
            />
            <PercentRow
              label={t('food.nutrients.saturatedFat')}
              valueLabel={`Ø ${latestWeek.avgSaturatedFat} / ${targets.saturatedFatMax} g`}
              percent={(latestWeek.avgSaturatedFat / targets.saturatedFatMax) * 100}
              color={
                latestWeek.avgSaturatedFat > targets.saturatedFatMax
                  ? uiColor('warning', dark)
                  : uiColor('success', dark)
              }
            />
            <PercentRow
              label={t('food.nutrients.sugars')}
              valueLabel={`Ø ${latestWeek.avgSugars} / ${targets.sugarsMax} g`}
              percent={(latestWeek.avgSugars / targets.sugarsMax) * 100}
              color={
                latestWeek.avgSugars > targets.sugarsMax
                  ? uiColor('warning', dark)
                  : uiColor('success', dark)
              }
            />
            <PercentRow
              label={t('food.nutrients.fiber')}
              valueLabel={`Ø ${latestWeek.avgFiber} / ${targets.fiberMin} g`}
              percent={(latestWeek.avgFiber / targets.fiberMin) * 100}
              color={
                latestWeek.avgFiber >= targets.fiberMin ? uiColor('success', dark) : accent
              }
            />
            <PercentRow
              label={t('food.nutrients.salt')}
              valueLabel={`Ø ${latestWeek.avgSalt} / ${targets.saltMax} g`}
              percent={(latestWeek.avgSalt / targets.saltMax) * 100}
              color={
                latestWeek.avgSalt > targets.saltMax
                  ? uiColor('warning', dark)
                  : uiColor('success', dark)
              }
            />
          </View>
          <Muted className="mt-2 text-xs">{t('stats.food.macroLegend')}</Muted>
        </Card>
      )}

      <Card className="mt-4">
        <SectionTitle>{t('stats.food.mealSplitTitle')}</SectionTitle>
        <View className="mt-3 gap-3">
          {meals.map((meal) => (
            <PercentRow
              key={meal.meal}
              label={t(`food.meals.${meal.meal}`)}
              valueLabel={`${meal.kcal} kcal · ${meal.percent} %`}
              percent={meal.percent}
              color={accent}
            />
          ))}
        </View>
      </Card>

      <Card className="mt-4">
        <SectionTitle>{t('stats.food.topFoodsTitle')}</SectionTitle>
        <View className="mt-2">
          {top.map((food, index) => (
            <View
              key={food.name}
              className={`flex-row items-baseline justify-between gap-3 py-2 ${
                index > 0 ? 'border-t border-border dark:border-border-dark' : ''
              }`}
            >
              <Body className="flex-1" numberOfLines={1}>
                {food.name}
              </Body>
              <Muted style={TABULAR}>
                {t('stats.food.topFoodMeta', { count: food.count, kcal: food.kcal })}
              </Muted>
            </View>
          ))}
        </View>
      </Card>

      {microRows.length > 0 && (
        <Card className="mt-4">
          <SectionTitle>{t('stats.food.microTrendTitle')}</SectionTitle>
          <Muted className="mt-1 text-xs">{t('stats.food.microTrendHint')}</Muted>
          <View className="mt-3 gap-2.5">
            {microRows.map((row) => (
              <View key={row.key} className="flex-row items-baseline justify-between gap-3">
                <Muted className="flex-1" numberOfLines={1}>
                  {t(`food.micros.${row.key}`)}
                </Muted>
                <Body
                  style={TABULAR}
                  className={`text-sm ${
                    row.avg >= 100
                      ? 'text-success dark:text-success-dark'
                      : row.avg < 50
                        ? 'text-warning dark:text-warning-dark'
                        : 'text-ink dark:text-ink-dark'
                  }`}
                >
                  {row.percents.map((p) => (p === null ? '–' : `${p} %`)).join(' → ')}
                </Body>
              </View>
            ))}
          </View>
        </Card>
      )}
    </View>
  );
}
