/**
 * "Schlaf & Gesundheit" card on the Today screen: last night's sleep (from
 * Apple Watch / Helio ring via Apple Health) with a stage bar, plus daily
 * metrics (steps, active energy, resting HR, HRV). iOS-only — the web build
 * shows a hint, the adapter stub reports unsupported.
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Activity, Flame, Footprints, HeartPulse, MoonStar } from 'lucide-react-native';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor, type UI_COLORS } from '@/constants/uiColors';
import { splitHm } from '@/domain/dayProgress';
import type { SleepStages } from '@/domain/health';
import { readinessScore, type ReadinessBand } from '@/domain/coach/readiness';
import { connectHealth, healthSupported, loadDailyHealth } from '@/health/healthData';
import { hasAnyHealthData, type DailyHealth } from '@/health/types';
import { useCoachStore } from '@/stores/coachStore';

/** sleep-stage chart colors (light/dark), mirrors the blockColors pattern */
const STAGE_COLORS: Record<keyof SleepStages, { light: string; dark: string }> = {
  deepMinutes: { light: '#4a90e2', dark: '#6aa6ec' },
  coreMinutes: { light: '#5bcbd8', dark: '#74d6e1' },
  remMinutes: { light: '#a98cea', dark: '#bba2f0' },
  awakeMinutes: { light: '#efa73f', dark: '#f4b95f' },
};
const STAGE_ORDER: { key: keyof SleepStages; label: string }[] = [
  { key: 'deepMinutes', label: 'deep' },
  { key: 'coreMinutes', label: 'core' },
  { key: 'remMinutes', label: 'rem' },
  { key: 'awakeMinutes', label: 'awake' },
];

function formatHm(totalMinutes: number): string {
  const { hours, minutes } = splitHm(totalMinutes);
  return `${hours}:${String(minutes).padStart(2, '0')} h`;
}

/** Readiness band → palette token. */
const BAND_COLOR: Record<ReadinessBand, keyof typeof UI_COLORS> = {
  low: 'danger',
  moderate: 'warning',
  high: 'success',
};

export function HealthCard() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const supported = healthSupported();
  const baseline = useCoachStore((s) => s.baseline);
  const [data, setData] = useState<DailyHealth | null>(null);
  const [connecting, setConnecting] = useState(false);
  const [connectTried, setConnectTried] = useState(false);

  const load = useCallback(async () => {
    setData(await loadDailyHealth(format(new Date(), 'yyyy-MM-dd')));
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (supported) void load();
    }, [supported, load])
  );

  const connect = async () => {
    setConnecting(true);
    try {
      await connectHealth();
      setConnectTried(true);
      await load();
    } finally {
      setConnecting(false);
    }
  };

  if (!supported) {
    return (
      <Card className="mt-4">
        <SectionTitle>{t('health.title')}</SectionTitle>
        <Muted className="mt-1">{t('health.webUnsupported')}</Muted>
      </Card>
    );
  }

  if (!data) return null; // loading

  if (!hasAnyHealthData(data)) {
    return (
      <Card className="mt-4">
        <SectionTitle>{t('health.title')}</SectionTitle>
        <Muted className="mt-1">
          {connectTried ? t('health.noData') : t('health.connectHint')}
        </Muted>
        <Button
          title={t('health.connect')}
          variant="secondary"
          size="sm"
          loading={connecting}
          onPress={() => void connect()}
          className="mt-3 self-start"
        />
      </Card>
    );
  }

  const sleep = data.sleep;
  const stageTotal = sleep
    ? STAGE_ORDER.reduce((sum, stage) => sum + sleep[stage.key], 0)
    : 0;

  const readiness = readinessScore(
    { hrvMs: data.hrvMs, restingHr: data.restingHr, asleepMinutes: sleep?.asleepMinutes ?? null },
    baseline
  );

  const metrics = [
    {
      key: 'steps',
      icon: <Footprints size={16} color={uiColor('accent', dark)} />,
      value: data.steps !== null ? String(data.steps) : null,
      unit: '',
    },
    {
      key: 'activeKcal',
      icon: <Flame size={16} color={uiColor('warning', dark)} />,
      value: data.activeKcal !== null ? String(data.activeKcal) : null,
      unit: ' kcal',
    },
    {
      key: 'restingHr',
      icon: <HeartPulse size={16} color={uiColor('danger', dark)} />,
      value: data.restingHr !== null ? String(data.restingHr) : null,
      unit: ' bpm',
    },
    {
      key: 'hrv',
      icon: <Activity size={16} color={uiColor('success', dark)} />,
      value: data.hrvMs !== null ? String(data.hrvMs) : null,
      unit: ' ms',
    },
  ].filter((metric) => metric.value !== null);

  return (
    <Card className="mt-4">
      <View className="flex-row items-center justify-between">
        <SectionTitle>{t('health.title')}</SectionTitle>
        {sleep && (
          <View className="flex-row items-center gap-1.5">
            <MoonStar size={16} color={uiColor('accent', dark)} />
            <Body style={TABULAR} className="text-xl font-bold">
              {formatHm(sleep.asleepMinutes)}
            </Body>
          </View>
        )}
      </View>

      {readiness && (
        <View
          className="mt-3 flex-row items-center gap-2.5 self-start rounded-xl border-2 px-3 py-1.5"
          style={{ borderColor: uiColor(BAND_COLOR[readiness.band], dark) }}
        >
          <Body
            style={[TABULAR, { color: uiColor(BAND_COLOR[readiness.band], dark) }]}
            className="text-3xl font-extrabold"
          >
            {readiness.score}
          </Body>
          <View>
            <Muted className="text-[10px] font-bold uppercase tracking-wider">
              {t('health.readiness.title')}
            </Muted>
            <Body
              className="text-xs font-bold"
              style={{ color: uiColor(BAND_COLOR[readiness.band], dark) }}
            >
              {t(`health.readiness.bands.${readiness.band}`)}
            </Body>
          </View>
        </View>
      )}

      {sleep && (
        <>
          <Muted className="mt-0.5" style={TABULAR}>
            {sleep.bedtime && sleep.wakeTime
              ? t('health.inBed', {
                  from: format(parseISO(sleep.bedtime), 'HH:mm'),
                  to: format(parseISO(sleep.wakeTime), 'HH:mm'),
                })
              : null}
            {sleep.sourceName ? ` · ${sleep.sourceName}` : ''}
          </Muted>
          {stageTotal > 0 && (
            <>
              <View className="mt-3 h-2 flex-row overflow-hidden rounded-full bg-track dark:bg-track-dark">
                {STAGE_ORDER.map((stage) =>
                  sleep[stage.key] > 0 ? (
                    <View
                      key={stage.key}
                      style={{
                        flex: sleep[stage.key],
                        backgroundColor: STAGE_COLORS[stage.key][dark ? 'dark' : 'light'],
                      }}
                    />
                  ) : null
                )}
              </View>
              <View className="mt-2 flex-row flex-wrap gap-x-4 gap-y-1">
                {STAGE_ORDER.map((stage) =>
                  sleep[stage.key] > 0 ? (
                    <View key={stage.key} className="flex-row items-center gap-1.5">
                      <View
                        className="h-2 w-2 rounded-full"
                        style={{
                          backgroundColor: STAGE_COLORS[stage.key][dark ? 'dark' : 'light'],
                        }}
                      />
                      <Muted style={TABULAR} className="text-xs">
                        {t(`health.stages.${stage.label}`)} {formatHm(sleep[stage.key])}
                      </Muted>
                    </View>
                  ) : null
                )}
              </View>
            </>
          )}
        </>
      )}

      {metrics.length > 0 && (
        <View
          className={`flex-row flex-wrap gap-x-6 gap-y-2 ${sleep ? 'mt-3 border-t border-border dark:border-border-dark pt-3' : 'mt-2'}`}
        >
          {metrics.map((metric) => (
            <View key={metric.key} className="flex-row items-center gap-1.5">
              {metric.icon}
              <Body style={TABULAR} className="font-semibold">
                {metric.value}
                {metric.unit}
              </Body>
              <Muted className="text-xs">{t(`health.${metric.key}`)}</Muted>
            </View>
          ))}
        </View>
      )}
    </Card>
  );
}
