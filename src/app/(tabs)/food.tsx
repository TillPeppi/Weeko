/**
 * Food tracker day view: kcal/macro totals vs. daily targets (progress bars),
 * diet-quality row (fiber, sugar, salt, saturated fat), the week's kcal trend,
 * micronutrient coverage (% of EU reference values, when products carry the
 * data) and the day's entries grouped by meal with inline editing.
 */
import { useCallback, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import { ChevronLeft, ChevronRight, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Body, Label, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { dateFnsLocale } from '@/i18n';
import type { FoodEntry } from '@/db/schema';
import type { MealType } from '@/db/repos/foodRepo';
import {
  formatMicroAmount,
  microPercent,
  MICRO_KEYS,
  scaleNutrients,
  type MicroKey,
} from '@/domain/nutrition';
import { addDaysIso } from '@/domain/time';
import { todayIso, useFoodStore } from '@/stores/foodStore';

const MEALS: MealType[] = ['breakfast', 'lunch', 'dinner', 'snack'];

function Bar({ percent, color }: { percent: number; color: string }) {
  return (
    <View className="h-1.5 overflow-hidden rounded-full bg-track dark:bg-track-dark">
      <View
        className="h-full rounded-full"
        style={{ width: `${Math.min(100, Math.max(0, percent))}%`, backgroundColor: color }}
      />
    </View>
  );
}

interface TargetRowProps {
  label: string;
  value: number;
  target: number;
  unit: string;
  /** 'min': reaching the target is good · 'max': staying below is good · 'ref': neutral guide value */
  kind: 'min' | 'max' | 'ref';
  dark: boolean;
  hint?: string;
}

function TargetRow({ label, value, target, unit, kind, dark, hint }: TargetRowProps) {
  const percent = target > 0 ? (value / target) * 100 : 0;
  const color =
    kind === 'max'
      ? percent > 100
        ? uiColor('danger', dark)
        : percent > 80
          ? uiColor('warning', dark)
          : uiColor('success', dark)
      : kind === 'min'
        ? percent >= 100
          ? uiColor('success', dark)
          : uiColor('accent', dark)
        : uiColor('accent', dark);
  return (
    <View className="gap-1">
      <View className="flex-row items-baseline justify-between">
        <Muted>
          {label}
          {hint ? ` (${hint})` : ''}
        </Muted>
        <Muted style={TABULAR}>
          {Math.round(value * 10) / 10} / {target} {unit}
        </Muted>
      </View>
      <Bar percent={percent} color={color} />
    </View>
  );
}

interface EntryEdit {
  id: string;
  amount: string;
  meal: MealType;
}

export default function FoodScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const store = useFoodStore();
  const [editing, setEditing] = useState<EntryEdit | null>(null);

  useFocusEffect(
    useCallback(() => {
      void store.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const { totals, targets, date, entries, trend, activityKcal, microGaps, gapsDaysTracked } =
    store;
  const isToday = date === todayIso();
  const kcal = totals.kcal ?? 0;
  // Apple-Health activity raises the day's kcal budget
  const kcalTarget = targets.kcal + (activityKcal ?? 0);
  const kcalPercent = (kcal / kcalTarget) * 100;

  const microsPresent = MICRO_KEYS.filter((key) => (totals.micros?.[key] ?? 0) > 0);

  const trendDaysWithData = trend.filter((day) => day.kcal > 0);
  const trendAvg =
    trendDaysWithData.length > 0
      ? Math.round(
          trendDaysWithData.reduce((sum, day) => sum + day.kcal, 0) / trendDaysWithData.length
        )
      : 0;
  const trendScale = Math.max(targets.kcal, ...trend.map((day) => day.kcal));

  const saveEdit = async () => {
    if (!editing) return;
    const amountG = Number(editing.amount.replace(',', '.'));
    if (!Number.isFinite(amountG) || amountG <= 0) return;
    await store.update(editing.id, { amountG, meal: editing.meal });
    setEditing(null);
  };

  const entryRow = (entry: FoodEntry) => {
    const absolute = scaleNutrients(entry.nutrients, entry.amountG);
    if (editing?.id === entry.id) {
      return (
        <View
          key={entry.id}
          className="gap-3 border-t border-border dark:border-border-dark py-3"
        >
          <Body className="font-semibold">{entry.name}</Body>
          <Field
            label={t('food.add.amount')}
            value={editing.amount}
            onChangeText={(amount) => setEditing({ ...editing, amount })}
            keyboardType="numeric"
            maxLength={6}
            style={TABULAR}
          />
          <View>
            <Label>{t('food.add.meal')}</Label>
            <SegmentedControl<MealType>
              options={MEALS.map((value) => ({ value, label: t(`food.meals.${value}`) }))}
              value={editing.meal}
              onChange={(meal) => setEditing({ ...editing, meal })}
            />
          </View>
          <View className="flex-row justify-end gap-2">
            <Button
              title={t('common.cancel')}
              variant="secondary"
              size="sm"
              onPress={() => setEditing(null)}
            />
            <Button title={t('common.save')} size="sm" onPress={() => void saveEdit()} />
          </View>
        </View>
      );
    }
    return (
      <View
        key={entry.id}
        className="flex-row items-center gap-3 border-t border-border dark:border-border-dark py-2"
      >
        <Pressable
          className="flex-1 active:opacity-70"
          onPress={() =>
            setEditing({ id: entry.id, amount: String(entry.amountG), meal: entry.meal })
          }
        >
          <Body>{entry.name}</Body>
          <Muted style={TABULAR}>
            {entry.amountG} g{absolute.kcal !== undefined ? ` · ${absolute.kcal} kcal` : ''}
            {absolute.protein !== undefined
              ? ` · ${absolute.protein} g ${t('food.proteinShort')}`
              : ''}
          </Muted>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void store.remove(entry.id)}
          className="p-1 active:opacity-60"
        >
          <Trash2 size={16} color={uiColor('danger', dark)} />
        </Pressable>
      </View>
    );
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>{t('food.title')}</Title>
        <View className="flex-row items-center gap-1">
          <Pressable
            accessibilityRole="button"
            onPress={() => void store.setDate(addDaysIso(date, -1))}
            className="p-2 active:opacity-60"
          >
            <ChevronLeft size={20} color={uiColor('muted', dark)} />
          </Pressable>
          <Pressable accessibilityRole="button" onPress={() => void store.setDate(todayIso())}>
            <Body style={TABULAR} className="font-semibold">
              {isToday
                ? t('food.today')
                : format(parseISO(date), 'EEE, d. MMM', { locale: dateFnsLocale() })}
            </Body>
          </Pressable>
          <Pressable
            accessibilityRole="button"
            onPress={() => void store.setDate(addDaysIso(date, 1))}
            className="p-2 active:opacity-60"
          >
            <ChevronRight size={20} color={uiColor('muted', dark)} />
          </Pressable>
        </View>
      </View>

      <Animated.View entering={FadeInDown.duration(220)}>
        <Card elevated className="mt-4">
          <View className="flex-row items-baseline justify-between">
            <SectionTitle>{t('food.totals')}</SectionTitle>
            <Body style={TABULAR} className="text-xl font-bold">
              {kcal} / {kcalTarget} kcal
            </Body>
          </View>
          <View className="mt-2">
            <Bar
              percent={kcalPercent}
              color={kcalPercent > 110 ? uiColor('warning', dark) : uiColor('accent', dark)}
            />
          </View>
          {activityKcal !== null && activityKcal > 0 && (
            <Muted style={TABULAR} className="mt-1.5 text-xs">
              {t('food.activityBonus', { base: targets.kcal, kcal: activityKcal })}
            </Muted>
          )}
          <View className="mt-4 gap-3">
            <TargetRow
              label={t('food.nutrients.protein')}
              value={totals.protein ?? 0}
              target={targets.proteinMin}
              unit="g"
              kind="min"
              dark={dark}
              hint={t('food.min')}
            />
            <TargetRow
              label={t('food.nutrients.carbs')}
              value={totals.carbs ?? 0}
              target={targets.carbsRef}
              unit="g"
              kind="ref"
              dark={dark}
            />
            <TargetRow
              label={t('food.nutrients.fat')}
              value={totals.fat ?? 0}
              target={targets.fatRef}
              unit="g"
              kind="ref"
              dark={dark}
            />
            <TargetRow
              label={t('food.nutrients.fiber')}
              value={totals.fiber ?? 0}
              target={targets.fiberMin}
              unit="g"
              kind="min"
              dark={dark}
              hint={t('food.min')}
            />
            <TargetRow
              label={t('food.nutrients.sugars')}
              value={totals.sugars ?? 0}
              target={targets.sugarsMax}
              unit="g"
              kind="max"
              dark={dark}
              hint={t('food.max')}
            />
            <TargetRow
              label={t('food.nutrients.salt')}
              value={totals.salt ?? 0}
              target={targets.saltMax}
              unit="g"
              kind="max"
              dark={dark}
              hint={t('food.max')}
            />
            <TargetRow
              label={t('food.nutrients.saturatedFat')}
              value={totals.saturatedFat ?? 0}
              target={targets.saturatedFatMax}
              unit="g"
              kind="max"
              dark={dark}
              hint={t('food.max')}
            />
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={FadeInDown.duration(220).delay(40)}>
        <Card className="mt-4">
          <View className="flex-row items-baseline justify-between">
            <SectionTitle>{t('food.trend.title')}</SectionTitle>
            {trendAvg > 0 && (
              <Muted style={TABULAR}>{t('food.trend.avg', { kcal: trendAvg })}</Muted>
            )}
          </View>
          <View className="mt-3 flex-row items-end gap-1.5">
            {trend.map((day, index) => {
              const selected = day.date === date;
              const height = trendScale > 0 ? Math.max(3, (day.kcal / trendScale) * 64) : 3;
              const over = day.kcal > targets.kcal * 1.1;
              return (
                <Pressable
                  key={day.date}
                  className="flex-1 items-center gap-1 active:opacity-60"
                  onPress={() => void store.setDate(day.date)}
                >
                  <View
                    className="w-full rounded-t-md"
                    style={{
                      height,
                      backgroundColor:
                        day.kcal === 0
                          ? dark
                            ? '#2c2f3a'
                            : '#e3dcc9'
                          : over
                            ? uiColor('warning', dark)
                            : selected
                              ? uiColor('accent', dark)
                              : `${uiColor('accent', dark)}66`,
                    }}
                  />
                  <Muted
                    style={TABULAR}
                    className={`text-[10px] ${selected ? 'font-bold text-accent dark:text-accent-dark' : ''}`}
                  >
                    {t(`weekdaysShort.${index + 1}`)}
                  </Muted>
                </Pressable>
              );
            })}
          </View>
        </Card>
      </Animated.View>

      {microsPresent.length > 0 && (
        <Animated.View entering={FadeInDown.duration(220).delay(80)}>
          <Card className="mt-4">
            <SectionTitle>{t('food.micros.title')}</SectionTitle>
            <View className="mt-3 gap-3">
              {microsPresent.map((key: MicroKey) => {
                const amount = totals.micros![key]!;
                const percent = microPercent(key, amount);
                return (
                  <View key={key} className="gap-1">
                    <View className="flex-row items-baseline justify-between">
                      <Muted>{t(`food.micros.${key}`)}</Muted>
                      <Muted style={TABULAR}>
                        {formatMicroAmount(key, amount)} · {percent} %
                      </Muted>
                    </View>
                    <Bar
                      percent={percent}
                      color={percent >= 100 ? uiColor('success', dark) : uiColor('accent', dark)}
                    />
                  </View>
                );
              })}
            </View>
            <Muted className="mt-3 text-xs">{t('food.micros.hint')}</Muted>
          </Card>
        </Animated.View>
      )}

      {gapsDaysTracked >= 3 && microGaps.length > 0 && (
        <Animated.View entering={FadeInDown.duration(220).delay(100)}>
          <Card className="mt-4">
            <SectionTitle>{t('food.supplements.title')}</SectionTitle>
            <Muted className="mt-1">
              {t('food.supplements.intro', { days: gapsDaysTracked })}
            </Muted>
            <View className="mt-3 gap-2.5">
              {microGaps.slice(0, 5).map((gap) => (
                <View key={gap.key}>
                  <View className="flex-row items-baseline justify-between">
                    <Body className="font-semibold">{t(`food.micros.${gap.key}`)}</Body>
                    <Muted style={TABULAR}>Ø {gap.percent} %</Muted>
                  </View>
                  <Muted className="text-xs">{t(`food.supplements.sources.${gap.key}`)}</Muted>
                </View>
              ))}
            </View>
            <Muted className="mt-3 text-xs">{t('food.supplements.supplementNote')}</Muted>
            <Muted className="mt-1.5 text-xs">
              {t('food.supplements.dataNote')} {t('food.supplements.disclaimer')}
            </Muted>
          </Card>
        </Animated.View>
      )}

      {MEALS.map((mealKey, index) => {
        const mealEntries = entries.filter((entry) => entry.meal === mealKey);
        return (
          <Animated.View key={mealKey} entering={FadeInDown.duration(220).delay(120 + index * 40)}>
            <Card className="mt-4">
              <View className="flex-row items-center justify-between">
                <SectionTitle>{t(`food.meals.${mealKey}`)}</SectionTitle>
                <Pressable
                  accessibilityRole="button"
                  onPress={() =>
                    router.push({ pathname: '/food/add', params: { meal: mealKey } })
                  }
                  className="flex-row items-center gap-1 p-1 active:opacity-60"
                >
                  <Plus size={16} color={uiColor('accent', dark)} />
                  <Body className="text-sm font-semibold text-accent dark:text-accent-dark">
                    {t('food.addEntry')}
                  </Body>
                </Pressable>
              </View>
              {mealEntries.length === 0 ? (
                <Muted className="mt-2">{t('food.mealEmpty')}</Muted>
              ) : (
                <View className="mt-2">{mealEntries.map(entryRow)}</View>
              )}
            </Card>
          </Animated.View>
        );
      })}

      <Muted className="mt-6 text-xs">{t('food.add.attribution')}</Muted>
    </Screen>
  );
}
