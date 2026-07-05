/**
 * Statistics screen — one of Weeko's main features. Aggregates the local
 * data (training, nutrition, week plan, Apple Health) into trends and
 * records. Stack screen (like Settings), reached from the Today header.
 * Four sections via a segmented control; each loads its own data lazily.
 */
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format } from 'date-fns';
import { X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Muted, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { Pressable } from 'react-native';
import { TrainingStatsSection } from '@/components/stats/TrainingStatsSection';
import { NutritionStatsSection } from '@/components/stats/NutritionStatsSection';
import { PlanStatsSection } from '@/components/stats/PlanStatsSection';
import { HealthStatsSection } from '@/components/stats/HealthStatsSection';
import { listDoneSessions, listStatsSetRows, type StatsSetRow } from '@/db/repos/trainingRepo';
import { listExercises } from '@/db/repos/exerciseRepo';
import { listEntriesBetween } from '@/db/repos/foodRepo';
import { listWeeksWithBlocks, type WeekWithBlocks } from '@/db/repos/weekRepo';
import { listTasks } from '@/db/repos/taskRepo';
import { getProfile } from '@/db/repos/profileRepo';
import { healthSupported, loadHealthRange } from '@/health/healthData';
import { dailyTargets, type NutrientTargets } from '@/domain/nutrition';
import { addDaysIso } from '@/domain/time';
import type { HealthDay } from '@/domain/healthStats';
import type { Exercise, FoodEntry, Task, WorkoutSession } from '@/db/schema';

type Tab = 'training' | 'food' | 'plan' | 'health';

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

export default function StatsScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const today = todayIso();
  const [tab, setTab] = useState<Tab>('training');

  const [setRows, setSetRows] = useState<StatsSetRow[]>([]);
  const [sessions, setSessions] = useState<WorkoutSession[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [entries, setEntries] = useState<FoodEntry[]>([]);
  const [targets, setTargets] = useState<NutrientTargets>(dailyTargets(null));
  const [weeks, setWeeks] = useState<WeekWithBlocks[]>([]);
  const [tasks, setTasks] = useState<Task[]>([]);
  const [healthDays, setHealthDays] = useState<HealthDay[]>([]);
  const supported = healthSupported();

  const loadTraining = useCallback(async () => {
    const [rows, doneSessions, exerciseList] = await Promise.all([
      listStatsSetRows(),
      listDoneSessions(),
      listExercises(),
    ]);
    setSetRows(rows);
    setSessions(doneSessions);
    setExercises(exerciseList);
  }, []);

  const loadFood = useCallback(async () => {
    const start = addDaysIso(today, -27);
    const [foodEntries, profile] = await Promise.all([
      listEntriesBetween(start, today),
      getProfile(),
    ]);
    setEntries(foodEntries);
    setTargets(dailyTargets(profile, profile?.nutritionGoals));
  }, [today]);

  const loadPlan = useCallback(async () => {
    const [weekList, taskList] = await Promise.all([listWeeksWithBlocks(12), listTasks()]);
    setWeeks(weekList);
    setTasks(taskList);
  }, []);

  const loadHealth = useCallback(async () => {
    if (!supported) return;
    const dates = Array.from({ length: 7 }, (_, i) => addDaysIso(today, i - 6));
    setHealthDays(await loadHealthRange(dates).catch(() => []));
  }, [supported, today]);

  useEffect(() => {
    if (tab === 'training') void loadTraining();
    else if (tab === 'food') void loadFood();
    else if (tab === 'plan') void loadPlan();
    else if (tab === 'health') void loadHealth();
  }, [tab, loadTraining, loadFood, loadPlan, loadHealth]);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>{t('stats.title')}</Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="p-2 active:opacity-60"
        >
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      <Muted className="mt-0.5">{t('stats.subtitle')}</Muted>

      <View className="mt-4">
        <SegmentedControl<Tab>
          options={[
            { value: 'training', label: t('tabs.training') },
            { value: 'food', label: t('tabs.food') },
            { value: 'plan', label: t('tabs.week') },
            { value: 'health', label: t('stats.health.tab') },
          ]}
          value={tab}
          onChange={setTab}
        />
      </View>

      <View className="pb-8">
        {tab === 'training' && (
          <TrainingStatsSection
            setRows={setRows}
            sessions={sessions}
            exercises={exercises}
            today={today}
          />
        )}
        {tab === 'food' && (
          <NutritionStatsSection entries={entries} targets={targets} today={today} />
        )}
        {tab === 'plan' && <PlanStatsSection weeks={weeks} tasks={tasks} />}
        {tab === 'health' && <HealthStatsSection supported={supported} days={healthDays} />}
      </View>
    </Screen>
  );
}
