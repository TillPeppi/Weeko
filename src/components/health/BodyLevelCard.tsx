/**
 * "Körper-Level" card (Today screen) — Bevel/Garmin-style day gauge: an energy
 * level that fills overnight (recovery) and drains through the day (strain),
 * plus the day's strain score and tonight's sleep need. iOS-only (HealthKit);
 * hides entirely when there is no data. Refreshes on focus + a light interval.
 */
import { useCallback, useEffect } from 'react';
import { View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { BatteryMedium } from 'lucide-react-native';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR } from '@/components/ui/Text';
import { uiColor, type UI_COLORS } from '@/constants/uiColors';
import { splitHm } from '@/domain/dayProgress';
import type { ReadinessBand } from '@/domain/coach/readiness';
import { healthSupported } from '@/health/healthData';
import { useBodyStore } from '@/stores/bodyStore';

/** Readiness/level band → palette token (mirrors the readiness badge). */
const BAND_COLOR: Record<ReadinessBand, keyof typeof UI_COLORS> = {
  low: 'danger',
  moderate: 'warning',
  high: 'success',
};

/** Re-run while the app is open — strain accumulates during the day. */
const REFRESH_INTERVAL_MS = 5 * 60_000;

function formatHm(totalMinutes: number): string {
  const { hours, minutes } = splitHm(totalMinutes);
  return `${hours}:${String(minutes).padStart(2, '0')} h`;
}

export function BodyLevelCard() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const supported = healthSupported();
  const level = useBodyStore((s) => s.level);
  const strain = useBodyStore((s) => s.strain);
  const sleepNeedMin = useBodyStore((s) => s.sleepNeedMin);
  const refresh = useBodyStore((s) => s.refresh);

  useFocusEffect(
    useCallback(() => {
      if (supported) void refresh();
    }, [supported, refresh])
  );

  useEffect(() => {
    if (!supported) return;
    const id = setInterval(() => void refresh(), REFRESH_INTERVAL_MS);
    return () => clearInterval(id);
  }, [supported, refresh]);

  if (!supported || !level) return null;

  const color = uiColor(BAND_COLOR[level.band], dark);

  return (
    <Card className="mt-4">
      <View className="flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <BatteryMedium size={18} color={color} />
          <SectionTitle>{t('body.title')}</SectionTitle>
        </View>
        <Body className="text-xs font-bold" style={{ color }}>
          {t(`health.readiness.bands.${level.band}`)}
        </Body>
      </View>

      <View className="mt-2 flex-row items-baseline gap-1">
        <Body style={[TABULAR, { color }]} className="text-4xl font-extrabold">
          {level.level}
        </Body>
        <Muted className="text-lg font-bold">%</Muted>
      </View>

      <View className="mt-2 h-2.5 overflow-hidden rounded-full border border-border dark:border-border-dark bg-track dark:bg-track-dark">
        <View className="h-full" style={{ width: `${level.level}%`, backgroundColor: color }} />
      </View>

      <View className="mt-3 flex-row flex-wrap gap-x-6 gap-y-1 border-t border-border dark:border-border-dark pt-3">
        {strain && (
          <View className="flex-row items-center gap-1.5">
            <Body style={TABULAR} className="font-semibold">
              {strain.score}
            </Body>
            <Muted className="text-xs">{t('body.strain')}</Muted>
          </View>
        )}
        {sleepNeedMin !== null && (
          <View className="flex-row items-center gap-1.5">
            <Body style={TABULAR} className="font-semibold">
              {formatHm(sleepNeedMin)}
            </Body>
            <Muted className="text-xs">{t('body.sleepNeed')}</Muted>
          </View>
        )}
      </View>

      <Muted className="mt-2 text-[10px]">{t('body.disclaimer')}</Muted>
    </Card>
  );
}
