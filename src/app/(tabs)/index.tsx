/**
 * Today view / home tab (§6.3), "Neo Brutal" direction: yellow tabular clock
 * chip, current block as a full-color card with progress bar + remaining time,
 * next/training cards, active-session banner with set counter.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format } from 'date-fns';
import { ChartColumn, Check, Circle, Play, Settings } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { CoachCard } from '@/components/coach/CoachCard';
import { BodyLevelCard } from '@/components/health/BodyLevelCard';
import { HealthCard } from '@/components/health/HealthCard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, Subtitle, TABULAR, Title } from '@/components/ui/Text';
import { BlockRow } from '@/components/timeline/BlockRow';
import {
  blockProgress,
  currentBlock,
  minutesRemaining,
  nextBlock,
  sortBlocksByStart,
  splitHm,
} from '@/domain/dayProgress';
import { toTimeString } from '@/domain/time';
import type { BlockStatus } from '@/domain/types';
import type { Block } from '@/db/schema';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { neoShadow, UI_COLORS, uiColor } from '@/constants/uiColors';
import { useWeekStore } from '@/stores/weekStore';
import { useTaskStore } from '@/stores/taskStore';
import { useTrainingStore } from '@/stores/trainingStore';
import { dateFnsLocale } from '@/i18n';

function nextStatus(status: BlockStatus): BlockStatus {
  switch (status) {
    case 'planned':
    case 'active':
      return 'done';
    case 'done':
      return 'skipped';
    case 'skipped':
      return 'planned';
  }
}

export default function TodayScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const weekStore = useWeekStore();
  const taskStore = useTaskStore();
  const training = useTrainingStore();
  const [nowTime, setNowTime] = useState(() => currentHHmm());

  useFocusEffect(
    useCallback(() => {
      void weekStore.refresh();
      void taskStore.refresh();
      void training.hydrate();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  useEffect(() => {
    const interval = setInterval(() => setNowTime(currentHHmm()), 30_000);
    return () => clearInterval(interval);
  }, []);

  const todayBlocks = useMemo(
    () => sortBlocksByStart(weekStore.todayBlocks),
    [weekStore.todayBlocks]
  );
  const active = useMemo(
    () =>
      currentBlock(
        todayBlocks.filter((b) => b.status !== 'done' && b.status !== 'skipped'),
        nowTime
      ),
    [todayBlocks, nowTime]
  );
  const upcoming = useMemo(() => nextBlock(todayBlocks, nowTime), [todayBlocks, nowTime]);

  const startTrainingFromBlock = async (block: Block) => {
    const templateKey = (block.details as { sessionTemplate?: string } | null)?.sessionTemplate;
    const template = training.templates.find((tpl) => tpl.key === templateKey);
    const id = await training.start({
      title: block.title,
      blockId: block.id,
      templateId: template?.id ?? null,
    });
    router.push(`/session/${id}`);
  };

  const progress = training.activeProgress;
  const showSetProgress = progress && progress.total > 0;

  return (
    <Screen>
      <View className="flex-row items-end justify-between">
        <View className="flex-1">
          <Title>{t('today.title')}</Title>
          <Subtitle className="mt-0.5 capitalize">
            {format(new Date(), 'EEEE, d. MMMM yyyy', { locale: dateFnsLocale() })}
          </Subtitle>
        </View>
        <View className="flex-row items-center gap-2">
          <View
            style={neoShadow(dark, 2)}
            className="rounded-xl border-2 border-border dark:border-border-dark bg-highlight dark:bg-highlight-dark px-3 py-1"
          >
            <Text
              accessibilityLabel={t('today.clock')}
              style={TABULAR}
              className="text-2xl font-extrabold text-ink"
            >
              {nowTime}
            </Text>
          </View>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('stats.title')}
            onPress={() => router.push('/stats')}
            className="p-1.5 active:opacity-60"
          >
            <ChartColumn size={20} color={uiColor('muted', dark)} />
          </Pressable>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel={t('tabs.settings')}
            onPress={() => router.push('/settings')}
            className="p-1.5 active:opacity-60"
          >
            <Settings size={20} color={uiColor('muted', dark)} />
          </Pressable>
        </View>
      </View>

      {training.activeSession && (
        <Card elevated className="mt-4">
          <View className="flex-row items-center justify-between">
            <View className="flex-1 pr-3">
              <SectionTitle>{t('today.trainingActive')}</SectionTitle>
              <Muted>
                {training.activeSession.title}
                {showSetProgress
                  ? ` · ${t('today.setProgress', { current: progress!.done, total: progress!.total })}`
                  : ''}
              </Muted>
            </View>
            <Button
              title={t('today.continueTraining')}
              size="sm"
              onPress={() => router.push(`/session/${training.activeSession!.id}`)}
            />
          </View>
        </Card>
      )}

      <View className="mt-5 gap-3">
        {active && (
          <HighlightBlock
            label={t('today.now')}
            block={active}
            nowTime={nowTime}
            dark={dark}
            action={
              active.type === 'training' && !training.activeSession ? (
                <Button
                  title={t('today.startTraining')}
                  size="sm"
                  icon={<Play size={16} color={UI_COLORS.ink.light} />}
                  onPress={() => void startTrainingFromBlock(active)}
                />
              ) : undefined
            }
          />
        )}
        {upcoming && upcoming !== active && (
          <HighlightBlock label={t('today.next')} block={upcoming} dark={dark} />
        )}
        {!active && !upcoming && todayBlocks.length === 0 && (
          <Card>
            <Muted>{t('today.noWeek')}</Muted>
            <Button
              title={t('week.empty.importCta')}
              variant="secondary"
              size="sm"
              onPress={() => router.push('/import')}
              className="mt-3 self-start"
            />
          </Card>
        )}
        {!active && !upcoming && todayBlocks.length > 0 && (
          <Muted>{t('today.nothingPlanned')}</Muted>
        )}
      </View>

      <CoachCard />

      <BodyLevelCard />

      <HealthCard />

      <SectionTitle className="mt-7">{t('today.openTasks')}</SectionTitle>
      <View className="mt-2 gap-2">
        {taskStore.todayOpen.length === 0 ? (
          <Muted>{t('today.noOpenTasks')}</Muted>
        ) : (
          taskStore.todayOpen.map((task) => (
            <Pressable
              key={task.id}
              onPress={() => void taskStore.complete(task.id)}
              style={neoShadow(dark, 2)}
              className="flex-row items-center gap-3 rounded-xl border-2 border-border dark:border-border-dark bg-card dark:bg-card-dark p-3 active:opacity-70"
            >
              <Circle size={20} color={uiColor('ink', dark)} />
              <View className="flex-1">
                <Body>{task.title}</Body>
                <Muted style={TABULAR}>
                  {t(`tasks.categories.${task.category}`, { defaultValue: task.category })}
                  {task.windowStart ? ` · ${task.windowStart}` : ''}
                  {task.estimatedMinutes ? ` · ${task.estimatedMinutes} ${t('common.minutesShort')}` : ''}
                </Muted>
              </View>
            </Pressable>
          ))
        )}
      </View>

      {todayBlocks.length > 0 && (
        <>
          <SectionTitle className="mt-7">{t('week.title')}</SectionTitle>
          <View className="mt-2 gap-2 pb-6">
            {todayBlocks.map((block) => (
              <BlockRow
                key={block.id}
                block={{
                  key: String(block.id),
                  type: block.type,
                  start: block.start,
                  end: block.end,
                  title: block.title,
                  status: block.status,
                }}
                highlight={block === active}
                onPress={() => void weekStore.setBlockStatus(block.id, nextStatus(block.status))}
              />
            ))}
          </View>
        </>
      )}
    </Screen>
  );
}

function currentHHmm(): string {
  const now = new Date();
  return toTimeString(now.getHours() * 60 + now.getMinutes());
}

function HighlightBlock({
  label,
  block,
  nowTime,
  dark,
  action,
}: {
  label: string;
  block: Block;
  /** present only for the current block → renders progress bar + remaining */
  nowTime?: string;
  dark: boolean;
  action?: React.ReactNode;
}) {
  const { t } = useTranslation();
  const palette = BLOCK_COLORS[block.type];
  const isNow = nowTime !== undefined;

  let remaining: string | null = null;
  let progress = 0;
  if (isNow) {
    progress = blockProgress(block.start, block.end, nowTime);
    const { hours, minutes } = splitHm(minutesRemaining(block.end, nowTime));
    remaining =
      hours > 0
        ? t('today.remainingHm', { h: hours, mm: String(minutes).padStart(2, '0') })
        : t('today.remainingM', { m: minutes });
  }

  // full-color block surface with an ink label chip ("Neo Brutal")
  return (
    <View
      style={neoShadow(dark, isNow ? 4 : 3)}
      className={`rounded-2xl border-2 p-4 ${palette.bgClass} ${palette.borderClass}`}
    >
      <View className="flex-row items-center justify-between">
        <View className="rounded-md bg-border dark:bg-border-dark px-2 py-0.5">
          <Text className="text-xs font-extrabold uppercase tracking-wider text-ink-dark dark:text-ink">
            {label}
          </Text>
        </View>
        {isNow ? (
          <Text style={TABULAR} className={`text-sm font-bold ${palette.textClass}`}>
            {remaining}
          </Text>
        ) : (
          block.status === 'done' && <Check size={18} color={UI_COLORS.ink.light} />
        )}
      </View>
      <Text className={`mt-2 text-xl font-extrabold ${palette.textClass}`}>{block.title}</Text>
      <Text style={TABULAR} className={`mt-0.5 text-sm font-semibold ${palette.textClass} opacity-70`}>
        {block.start}–{block.end} · {t(`blockTypes.${block.type}`)}
      </Text>
      {isNow && (
        <View className="mt-3 h-2 overflow-hidden rounded-full border border-border dark:border-border-dark bg-ink/10">
          <View
            className="h-full"
            style={{ width: `${Math.round(progress * 100)}%`, backgroundColor: UI_COLORS.ink.light }}
          />
        </View>
      )}
      {action && <View className="mt-3 self-start">{action}</View>}
    </View>
  );
}
