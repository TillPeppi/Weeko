/**
 * Week view (§6.3): vertical timeline per day. Phone: one day with tabs +
 * horizontal swipe gesture (direction-aware slide-in); tablet/desktop:
 * 7-column grid. Tap cycles block status (planned → done → skipped →
 * planned). A collapsible week-balance card shows done/skipped/open counts.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { FadeInLeft, FadeInRight, runOnJS } from 'react-native-reanimated';
import { format, parseISO } from 'date-fns';
import { CalendarPlus, ChevronDown, ChevronLeft, ChevronRight, Save } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/EmptyState';
import { Field } from '@/components/ui/Field';
import { Body, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { weekStats } from '@/domain/weekStats';
import type { BlockType } from '@/domain/types';
import { DayTimeline, type TimelineBlockData } from '@/components/timeline/DayTimeline';
import { useResponsive } from '@/hooks/useResponsive';
import { useWeekStore, todayIso } from '@/stores/weekStore';
import { saveWeekAsTemplate } from '@/db/repos/weekRepo';
import type { Block } from '@/db/schema';
import { addDaysIso, isoWeekOf, isoWeekday, toTimeString } from '@/domain/time';
import type { BlockStatus } from '@/domain/types';
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

function mondayOf(date: string): string {
  return addDaysIso(date, 1 - isoWeekday(date));
}

export default function WeekScreen() {
  const { t } = useTranslation();
  const { isTablet } = useResponsive();
  const { colorScheme } = useColorScheme();
  const mutedIcon = uiColor('muted', colorScheme === 'dark');
  const store = useWeekStore();
  const [selectedDay, setSelectedDay] = useState(() => isoWeekday(todayIso()) - 1);
  /** 1 = forward (slide in from the right), -1 = backward */
  const [dayDirection, setDayDirection] = useState(1);
  const [balanceOpen, setBalanceOpen] = useState(false);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [templateSaved, setTemplateSaved] = useState(false);

  const selectDayBy = useCallback((delta: number) => {
    setDayDirection(delta > 0 ? 1 : -1);
    setSelectedDay((current) => Math.max(0, Math.min(6, current + delta)));
  }, []);

  const swipeGesture = useMemo(
    () =>
      Gesture.Pan()
        .activeOffsetX([-24, 24])
        .failOffsetY([-16, 16])
        .onEnd((event) => {
          'worklet';
          if (event.translationX < -48) runOnJS(selectDayBy)(1);
          else if (event.translationX > 48) runOnJS(selectDayBy)(-1);
        }),
    [selectDayBy]
  );

  useFocusEffect(
    useCallback(() => {
      void store.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  // Monday of the displayed week, derived from any block or from today
  const weekDates = useMemo(() => {
    const anchor = store.data?.blocks[0]?.date ?? todayIso();
    const monday = mondayOf(anchor);
    return Array.from({ length: 7 }, (_, i) => addDaysIso(monday, i));
  }, [store.data]);

  const blocksByDate = useMemo(() => {
    const map = new Map<string, Block[]>();
    for (const b of store.data?.blocks ?? []) {
      const list = map.get(b.date) ?? [];
      list.push(b);
      map.set(b.date, list);
    }
    return map;
  }, [store.data]);

  const shiftWeek = (delta: number) => {
    const monday = mondayOf(weekDates[0]);
    const target = isoWeekOf(addDaysIso(monday, delta * 7));
    store.setWeek(target.year, target.isoWeek);
  };

  const toTimelineData = (blocks: Block[]): TimelineBlockData[] =>
    blocks.map((b) => ({
      key: String(b.id),
      type: b.type,
      start: b.start,
      end: b.end,
      title: b.title,
      status: b.status,
    }));

  const onBlockPress = (data: TimelineBlockData) => {
    const b = store.data?.blocks.find((x) => String(x.id) === data.key);
    if (b) void store.setBlockStatus(b.id, nextStatus(b.status));
  };

  const now = new Date();
  const nowTime = toTimeString(now.getHours() * 60 + now.getMinutes());
  const today = todayIso();
  const dark = colorScheme === 'dark';

  const stats = useMemo(() => weekStats(store.data?.blocks ?? []), [store.data]);

  const saveTemplate = async () => {
    if (!store.data || !templateName.trim()) return;
    await saveWeekAsTemplate(templateName.trim(), store.data);
    setTemplateName('');
    setSavingTemplate(false);
    setTemplateSaved(true);
    setTimeout(() => setTemplateSaved(false), 2500);
  };

  return (
    <Screen wide scroll={false}>
      <View className="flex-row flex-wrap items-center justify-between gap-y-2">
        <View className="flex-row items-center gap-1">
          <Pressable accessibilityRole="button" onPress={() => shiftWeek(-1)} className="p-2 active:opacity-60">
            <ChevronLeft size={22} color={mutedIcon} />
          </Pressable>
          <Title style={TABULAR}>
            {t('week.weekOfYear', { week: store.isoWeek, year: store.year })}
          </Title>
          <Pressable accessibilityRole="button" onPress={() => shiftWeek(1)} className="p-2 active:opacity-60">
            <ChevronRight size={22} color={mutedIcon} />
          </Pressable>
        </View>
        <View className="max-w-full flex-row flex-wrap gap-2">
          {store.data && (
            <Button
              title={t('week.saveAsTemplate')}
              variant="secondary"
              size="sm"
              icon={<Save size={16} color={mutedIcon} />}
              onPress={() => setSavingTemplate(!savingTemplate)}
            />
          )}
          <Button
            title={t('week.empty.importCta')}
            size="sm"
            icon={<CalendarPlus size={16} color={uiColor('ink', false)} />}
            onPress={() => router.push('/import')}
          />
        </View>
      </View>

      {savingTemplate && (
        <View className="mt-3 flex-row items-end gap-2">
          <Field
            className="flex-1"
            label={t('week.templateName')}
            value={templateName}
            onChangeText={setTemplateName}
            onSubmitEditing={saveTemplate}
          />
          <Button title={t('common.save')} onPress={saveTemplate} disabled={!templateName.trim()} />
        </View>
      )}
      {templateSaved && <Muted className="mt-2">{t('week.templateSaved')}</Muted>}

      {store.data && stats.total > 0 && (
        <Card className="mt-3">
          <Pressable
            accessibilityRole="button"
            onPress={() => setBalanceOpen(!balanceOpen)}
            className="flex-row items-center justify-between active:opacity-70"
          >
            <SectionTitle>{t('week.balance.title')}</SectionTitle>
            <View className="flex-row items-center gap-2">
              <Body style={TABULAR} className="font-semibold">
                {stats.done} / {stats.total} {t('week.balance.done')}
              </Body>
              {balanceOpen ? (
                <ChevronDown size={18} color={mutedIcon} />
              ) : (
                <ChevronRight size={18} color={mutedIcon} />
              )}
            </View>
          </Pressable>
          <View className="mt-2 h-1.5 flex-row overflow-hidden rounded-full bg-track dark:bg-track-dark">
            <View
              style={{
                flex: stats.done,
                backgroundColor: uiColor('success', dark),
              }}
            />
            <View
              style={{
                flex: stats.skipped,
                backgroundColor: uiColor('warning', dark),
              }}
            />
            <View style={{ flex: stats.open }} />
          </View>
          {balanceOpen && (
            <View className="mt-3 gap-2">
              <Muted style={TABULAR}>
                {stats.done} {t('week.balance.done')} · {stats.skipped}{' '}
                {t('week.balance.skipped')} · {stats.open} {t('week.balance.open')}
              </Muted>
              <View className="flex-row flex-wrap gap-1.5">
                {(Object.entries(stats.byType) as [BlockType, (typeof stats.byType)[BlockType]][])
                  .filter(([, counts]) => counts !== undefined)
                  .map(([type, counts]) => (
                    <View
                      key={type}
                      className="flex-row items-center gap-1.5 rounded-full border border-border dark:border-border-dark px-2.5 py-1"
                    >
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: dark
                            ? BLOCK_COLORS[type].hexDark
                            : BLOCK_COLORS[type].hex,
                        }}
                      />
                      <Muted style={TABULAR} className="text-xs">
                        {t(`blockTypes.${type}`)} {counts!.done}/{counts!.total}
                      </Muted>
                    </View>
                  ))}
              </View>
            </View>
          )}
        </Card>
      )}

      {!store.data ? (
        <EmptyState
          title={t('week.empty.title')}
          subtitle={t('week.empty.subtitle')}
          action={
            <Button title={t('week.empty.importCta')} onPress={() => router.push('/import')} />
          }
        />
      ) : isTablet ? (
        // 7-column grid (tablet/desktop)
        <ScrollView className="mt-4 flex-1">
          <View className="flex-row gap-1">
            {weekDates.map((date, index) => (
              <View key={date} className="flex-1">
                <View className={`mb-1 items-center rounded-lg py-1 ${date === today ? 'border-2 border-border dark:border-border-dark bg-highlight dark:bg-highlight-dark' : ''}`}>
                  <Muted
                    style={TABULAR}
                    className={date === today ? 'font-bold text-ink' : ''}
                  >
                    {t(`weekdaysShort.${index + 1}`)}{' '}
                    {format(parseISO(date), 'd.M.', { locale: dateFnsLocale() })}
                  </Muted>
                </View>
                <DayTimeline
                  blocks={toTimelineData(blocksByDate.get(date) ?? [])}
                  onBlockPress={onBlockPress}
                  nowTime={date === today ? nowTime : undefined}
                  hideHourLabels={index !== 0}
                  pxPerMinute={0.9}
                />
              </View>
            ))}
          </View>
        </ScrollView>
      ) : (
        // single day with tabs (phone)
        <View className="mt-3 flex-1">
          <View className="flex-row gap-1">
            {weekDates.map((date, index) => {
              const selected = index === selectedDay;
              return (
                <Pressable
                  key={date}
                  onPress={() => {
                    setDayDirection(index > selectedDay ? 1 : -1);
                    setSelectedDay(index);
                  }}
                  className={`flex-1 items-center rounded-lg py-1.5 ${selected ? 'border-2 border-border dark:border-border-dark bg-highlight dark:bg-highlight-dark' : date === today ? 'bg-highlight/40 dark:bg-highlight-dark/20' : ''}`}
                >
                  <Text
                    className={`text-xs font-bold ${selected ? 'text-ink' : 'text-ink-muted dark:text-ink-muted-dark'}`}
                  >
                    {t(`weekdaysShort.${index + 1}`)}
                  </Text>
                  <Text
                    style={TABULAR}
                    className={`text-[10px] ${selected ? 'font-semibold text-ink' : 'text-ink-muted dark:text-ink-muted-dark'}`}
                  >
                    {format(parseISO(date), 'd.M.')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <GestureDetector gesture={swipeGesture}>
            <Animated.View
              key={selectedDay}
              entering={(dayDirection > 0 ? FadeInRight : FadeInLeft).duration(180)}
              style={{ flex: 1 }}
            >
              <SectionTitle className="mt-3">
                {format(parseISO(weekDates[selectedDay]), 'EEEE, d. MMMM', {
                  locale: dateFnsLocale(),
                })}
              </SectionTitle>
              <ScrollView className="mt-2 flex-1">
                <DayTimeline
                  blocks={toTimelineData(blocksByDate.get(weekDates[selectedDay]) ?? [])}
                  onBlockPress={onBlockPress}
                  nowTime={weekDates[selectedDay] === today ? nowTime : undefined}
                />
              </ScrollView>
            </Animated.View>
          </GestureDetector>
        </View>
      )}
    </Screen>
  );
}
