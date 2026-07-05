/**
 * Analysis export: bundles one week or month of local data (plan, training,
 * nutrition, body, Apple Health) into compact JSON plus an analysis prompt —
 * ready to paste into an external AI (Claude & co.). Web copies to the
 * clipboard, native opens the share sheet.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Platform, Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { addMonths, endOfMonth, format, parseISO, startOfMonth } from 'date-fns';
import { ChevronLeft, ChevronRight, Copy, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Body, Muted, SectionTitle, Subtitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { collectAnalysisRange, type AnalysisRangeData } from '@/db/repos/dataRepo';
import { healthSupported, loadHealthRange } from '@/health/healthData';
import {
  buildAnalysisExport,
  type ExportRange,
  type ExportRangeMode,
} from '@/domain/analysisExport';
import { dailyTargets } from '@/domain/nutrition';
import { addDaysIso, isoWeekOf, mondayOfWeek } from '@/domain/time';
import type { HealthDay } from '@/domain/healthStats';
import { copyOrShareText } from '@/utils/copyText';
import { dateFnsLocale } from '@/i18n';

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** All ISO dates of [start, end] (inclusive) — health range lookup. */
function datesBetween(start: string, end: string): string[] {
  const dates: string[] = [];
  let cursor = start;
  while (cursor <= end && dates.length < 62) {
    dates.push(cursor);
    cursor = addDaysIso(cursor, 1);
  }
  return dates;
}

export default function ExportScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [mode, setMode] = useState<ExportRangeMode>('week');
  /** 0 = current period, -1 = previous, … */
  const [offset, setOffset] = useState(0);
  const [data, setData] = useState<AnalysisRangeData | null>(null);
  const [healthDays, setHealthDays] = useState<HealthDay[]>([]);
  const [flash, setFlash] = useState<string | null>(null);

  const range: ExportRange = useMemo(() => {
    const today = todayIso();
    if (mode === 'week') {
      const monday = mondayOfWeek(addDaysIso(today, offset * 7));
      const { year, isoWeek } = isoWeekOf(monday);
      return {
        mode,
        start: monday,
        end: addDaysIso(monday, 6),
        label: t('week.weekOfYear', { week: isoWeek, year }),
      };
    }
    const monthDate = addMonths(parseISO(today), offset);
    return {
      mode,
      start: format(startOfMonth(monthDate), 'yyyy-MM-dd'),
      end: format(endOfMonth(monthDate), 'yyyy-MM-dd'),
      label: format(monthDate, 'MMMM yyyy', { locale: dateFnsLocale() }),
    };
  }, [mode, offset, t]);

  const load = useCallback(async () => {
    const collected = await collectAnalysisRange(range.start, range.end);
    setData(collected);
    if (healthSupported()) {
      setHealthDays(await loadHealthRange(datesBetween(range.start, range.end)));
    } else {
      setHealthDays([]);
    }
  }, [range.start, range.end]);

  useEffect(() => {
    setData(null);
    void load();
  }, [load]);

  const exportObject = useMemo(() => {
    if (!data) return null;
    const profile = data.profile
      ? {
          age: data.profile.age,
          sex: data.profile.sex,
          heightCm: data.profile.heightCm,
          weightKg: data.profile.weightKg,
          goal: data.profile.goal,
        }
      : null;
    return buildAnalysisExport({
      range,
      profile,
      targets: dailyTargets(data.profile, data.profile?.nutritionGoals),
      blocks: data.blocks,
      tasks: data.tasks,
      sessions: data.sessions,
      foodEntries: data.foodEntries,
      measurements: data.measurements,
      healthDays,
    });
  }, [data, healthDays, range]);

  const jsonText = useMemo(
    () => (exportObject ? JSON.stringify(exportObject, null, 1) : ''),
    [exportObject]
  );

  const foodDayCount = data ? new Set(data.foodEntries.map((entry) => entry.date)).size : 0;
  const healthDayCount = healthDays.filter(
    (day) =>
      day.sleepMinutes !== null || day.steps !== null || day.restingHr !== null || day.hrvMs !== null
  ).length;
  const isEmpty =
    data !== null &&
    data.blocks.length === 0 &&
    data.sessions.length === 0 &&
    data.foodEntries.length === 0 &&
    data.measurements.length === 0 &&
    healthDayCount === 0;

  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 2500);
  };

  const copy = async (withPrompt: boolean) => {
    const promptText = t('export.prompt', {
      label: range.label,
      start: range.start,
      end: range.end,
    });
    const text = withPrompt ? `${promptText}\n\n${jsonText}` : jsonText;
    const outcome = await copyOrShareText(text);
    showFlash(t(`export.${outcome}`));
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between pt-2">
        <Title>{t('export.title')}</Title>
        <Pressable
          accessibilityRole="button"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="p-2 active:opacity-60"
        >
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      <Subtitle className="mt-1">{t('export.subtitle')}</Subtitle>
      {flash && <Muted className="mt-2 text-success dark:text-success-dark">{flash}</Muted>}

      <SegmentedControl
        className="mt-4"
        options={[
          { value: 'week', label: t('export.week') },
          { value: 'month', label: t('export.month') },
        ]}
        value={mode}
        onChange={(next) => {
          setMode(next);
          setOffset(0);
        }}
      />

      <View className="mt-4 flex-row items-center justify-between">
        <Pressable
          accessibilityRole="button"
          onPress={() => setOffset(offset - 1)}
          className="p-2 active:opacity-60"
        >
          <ChevronLeft size={22} color={uiColor('ink', dark)} />
        </Pressable>
        <SectionTitle style={TABULAR}>
          {range.label} · {format(parseISO(range.start), 'd. MMM', { locale: dateFnsLocale() })} –{' '}
          {format(parseISO(range.end), 'd. MMM', { locale: dateFnsLocale() })}
        </SectionTitle>
        <Pressable
          accessibilityRole="button"
          onPress={() => setOffset(Math.min(0, offset + 1))}
          disabled={offset === 0}
          className={`p-2 active:opacity-60 ${offset === 0 ? 'opacity-30' : ''}`}
        >
          <ChevronRight size={22} color={uiColor('ink', dark)} />
        </Pressable>
      </View>

      <Card className="mt-4">
        <SectionTitle>{t('export.summaryTitle')}</SectionTitle>
        {data === null ? (
          <Muted className="mt-2">{t('common.loading')}</Muted>
        ) : isEmpty ? (
          <Muted className="mt-2">{t('export.empty')}</Muted>
        ) : (
          <View className="mt-2 gap-1">
            <Body style={TABULAR}>{t('export.blocks', { count: data.blocks.length })}</Body>
            <Body style={TABULAR}>{t('export.sessions', { count: data.sessions.length })}</Body>
            <Body style={TABULAR}>{t('export.foodDays', { count: foodDayCount })}</Body>
            <Body style={TABULAR}>
              {t('export.measurements', { count: data.measurements.length })}
            </Body>
            <Body style={TABULAR}>{t('export.tasks', { count: data.tasks.length })}</Body>
            <Body style={TABULAR}>{t('export.healthDays', { count: healthDayCount })}</Body>
          </View>
        )}
        {Platform.OS === 'web' && (
          <Muted className="mt-3 text-warning dark:text-warning-dark">
            {t('export.healthWebHint')}
          </Muted>
        )}
      </Card>

      <View className="mt-4 gap-3 pb-8">
        <Button
          title={t('export.copyWithPrompt')}
          icon={<Copy size={18} color={uiColor('ink', false)} />}
          onPress={() => void copy(true)}
          disabled={data === null || isEmpty}
        />
        <Button
          title={t('export.copyJson')}
          variant="secondary"
          icon={<Copy size={18} color={uiColor('muted', dark)} />}
          onPress={() => void copy(false)}
          disabled={data === null || isEmpty}
        />
      </View>
    </Screen>
  );
}
