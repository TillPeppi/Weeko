/**
 * Training statistics: streaks & Ø duration, weekly volume trend and
 * per-exercise progression with PR tiles and a max-weight chart.
 */
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import type { Exercise, WorkoutSession } from '@/db/schema';
import type { StatsSetRow } from '@/db/repos/trainingRepo';
import {
  exercisePrs,
  exerciseProgression,
  prSessionIds,
  type ExerciseSetRow,
} from '@/domain/exerciseStats';
import { avgSessionMinutes, trainingStreaks, weeklyTraining } from '@/domain/trainingStats';
import { BarChart, StatTile } from './StatBits';
import { dateFnsLocale } from '@/i18n';

interface Props {
  setRows: StatsSetRow[];
  sessions: WorkoutSession[];
  exercises: Exercise[];
  today: string;
}

function formatVolume(volumeKg: number): string {
  if (volumeKg >= 10000) return `${Math.round(volumeKg / 1000)}k`;
  if (volumeKg >= 1000) return `${Math.round(volumeKg / 100) / 10}k`;
  return volumeKg > 0 ? String(Math.round(volumeKg)) : '';
}

function formatKg(value: number): string {
  return String(Math.round(value * 10) / 10);
}

export function TrainingStatsSection({ setRows, sessions, exercises, today }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const accent = uiColor('accent', dark);
  const emptyColor = dark ? '#2c2f3a' : '#e3dcc9';

  const sessionDates = useMemo(() => sessions.map((s) => s.startedAt.slice(0, 10)), [sessions]);
  const streaks = useMemo(() => trainingStreaks(sessionDates, today), [sessionDates, today]);
  const avgMinutes = useMemo(() => avgSessionMinutes(sessions), [sessions]);
  const weekly = useMemo(
    () => weeklyTraining(sessionDates, setRows, today, 8),
    [sessionDates, setRows, today]
  );
  const avgSessionsPerWeek =
    Math.round((weekly.reduce((sum, w) => sum + w.sessions, 0) / weekly.length) * 10) / 10;

  const exercisesWithData = useMemo(() => {
    const ids = new Set(setRows.filter((row) => row.done && row.reps).map((row) => row.exerciseId));
    return exercises.filter((exercise) => ids.has(exercise.id));
  }, [setRows, exercises]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected =
    exercisesWithData.find((e) => e.id === selectedId) ?? exercisesWithData[0] ?? null;

  const points = useMemo(() => {
    if (!selected) return [];
    const rows: ExerciseSetRow[] = setRows
      .filter((row) => row.exerciseId === selected.id)
      .map(({ sessionId, date, reps, weightKg, done }) => ({ sessionId, date, reps, weightKg, done }));
    return exerciseProgression(rows);
  }, [setRows, selected]);
  const prs = useMemo(() => exercisePrs(points), [points]);
  const prIds = useMemo(() => prSessionIds(points), [points]);

  const chartPoints = points.slice(-10);
  const weighted = chartPoints.some((p) => p.maxWeightKg !== null);
  const lastPoint = points[points.length - 1];
  const isNewPr = points.length > 1 && lastPoint !== undefined && prIds.has(lastPoint.sessionId);

  const prDate = (date: string) =>
    format(parseISO(date), 'd. MMM', { locale: dateFnsLocale() });

  if (sessions.length === 0) {
    return (
      <Card className="mt-4">
        <Muted>{t('stats.training.empty')}</Muted>
      </Card>
    );
  }

  return (
    <View>
      <Card className="mt-4">
        <View className="flex-row gap-2">
          <StatTile
            value={String(streaks.currentWeeks)}
            label={t('stats.training.currentStreak')}
            sub={t('stats.training.weeksUnit')}
          />
          <StatTile
            value={String(streaks.longestWeeks)}
            label={t('stats.training.longestStreak')}
            sub={t('stats.training.weeksUnit')}
          />
          <StatTile
            value={avgMinutes !== null ? String(avgMinutes) : '–'}
            label={t('stats.training.avgDuration')}
            sub={t('common.minutesShort')}
          />
        </View>
      </Card>

      <Card className="mt-4">
        <SectionTitle>{t('stats.training.volumeTitle')}</SectionTitle>
        <View className="mt-3">
          <BarChart
            emptyColor={emptyColor}
            bars={weekly.map((week, index) => ({
              key: `${week.year}-${week.isoWeek}`,
              label: String(week.isoWeek),
              value: week.volumeKg,
              valueLabel: formatVolume(week.volumeKg),
              color: index === weekly.length - 1 ? accent : `${accent}99`,
              highlighted: index === weekly.length - 1,
            }))}
          />
        </View>
        <Muted style={TABULAR} className="mt-2 text-xs">
          {t('stats.training.volumeLegend', { sessions: avgSessionsPerWeek })}
        </Muted>
      </Card>

      <Card className="mt-4">
        <View className="flex-row items-center justify-between gap-2">
          <SectionTitle>{t('stats.training.progressionTitle')}</SectionTitle>
          {isNewPr && (
            <Body className="text-sm font-semibold text-success dark:text-success-dark">
              {t('stats.training.newPr')}
            </Body>
          )}
        </View>
        {exercisesWithData.length === 0 ? (
          <Muted className="mt-2">{t('stats.training.progressionEmpty')}</Muted>
        ) : (
          <>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mt-3">
              <View className="flex-row gap-2">
                {exercisesWithData.map((exercise) => {
                  const active = selected?.id === exercise.id;
                  return (
                    <Pressable
                      key={exercise.id}
                      accessibilityRole="button"
                      accessibilityState={{ selected: active }}
                      onPress={() => setSelectedId(exercise.id)}
                      className={`rounded-full border px-3 py-1.5 ${
                        active
                          ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
                          : 'border-border dark:border-border-dark'
                      }`}
                    >
                      <Body
                        className={`text-sm ${
                          active
                            ? 'font-semibold text-white'
                            : 'text-ink-muted dark:text-ink-muted-dark'
                        }`}
                      >
                        {exercise.name}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </ScrollView>

            <View className="mt-3 flex-row flex-wrap gap-2">
              {prs.maxWeight && (
                <StatTile
                  value={`${formatKg(prs.maxWeight.value)} kg`}
                  label={t('stats.training.prMaxWeight')}
                  sub={prDate(prs.maxWeight.date)}
                />
              )}
              {prs.best1Rm && (
                <StatTile
                  value={`${formatKg(prs.best1Rm.value)} kg`}
                  label={t('stats.training.prE1rm')}
                  sub={prDate(prs.best1Rm.date)}
                />
              )}
              {prs.maxSessionVolume && (
                <StatTile
                  value={`${formatVolume(prs.maxSessionVolume.value) || '0'} kg`}
                  label={t('stats.training.prVolume')}
                  sub={prDate(prs.maxSessionVolume.date)}
                />
              )}
              {prs.maxReps && (
                <StatTile
                  value={String(prs.maxReps.value)}
                  label={t('stats.training.prReps')}
                  sub={prDate(prs.maxReps.date)}
                />
              )}
            </View>

            {chartPoints.length > 0 && (
              <View className="mt-4">
                <Muted className="mb-2 text-xs">
                  {weighted
                    ? t('stats.training.chartMaxWeight')
                    : t('stats.training.chartMaxReps')}
                </Muted>
                <BarChart
                  emptyColor={emptyColor}
                  bars={chartPoints.map((point) => {
                    const value = weighted ? (point.maxWeightKg ?? 0) : (point.maxReps ?? 0);
                    return {
                      key: String(point.sessionId),
                      label: format(parseISO(point.date), 'd.M.', { locale: dateFnsLocale() }),
                      value,
                      valueLabel: value > 0 ? formatKg(value) : '',
                      color: prIds.has(point.sessionId) ? uiColor('success', dark) : accent,
                      highlighted: point.sessionId === lastPoint?.sessionId,
                    };
                  })}
                />
                <Muted className="mt-2 text-xs">{t('stats.training.chartLegend')}</Muted>
              </View>
            )}
          </>
        )}
      </Card>
    </View>
  );
}
