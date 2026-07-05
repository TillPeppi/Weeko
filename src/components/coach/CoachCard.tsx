/**
 * Coach card (Today screen) — renders the insight engine's output
 * (domain/coach) as a short, prioritized list. Hidden when there's nothing
 * to say, so it never adds noise.
 */
import { useCallback } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Bell, Lightbulb, PartyPopper, TriangleAlert, X, type LucideIcon } from 'lucide-react-native';
import { Body, SectionTitle } from '@/components/ui/Text';
import { neoShadow, uiColor, type UI_COLORS } from '@/constants/uiColors';
import type { InsightKind } from '@/domain/coach/insights';
import { useCoachStore } from '@/stores/coachStore';

/** Icon + palette token per insight kind. */
const KIND_STYLE: Record<InsightKind, { Icon: LucideIcon; color: keyof typeof UI_COLORS }> = {
  warning: { Icon: TriangleAlert, color: 'warning' },
  suggestion: { Icon: Lightbulb, color: 'accent' },
  praise: { Icon: PartyPopper, color: 'success' },
  nudge: { Icon: Bell, color: 'muted' },
};

/** Show at most this many insights at once — the rest wait for the next run. */
const MAX_VISIBLE = 3;

export function CoachCard() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const insights = useCoachStore((s) => s.insights);
  const refresh = useCoachStore((s) => s.refresh);
  const dismiss = useCoachStore((s) => s.dismiss);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  if (insights.length === 0) return null;

  return (
    <>
      <SectionTitle className="mt-7">{t('coach.title')}</SectionTitle>
      <View className="mt-2 gap-2">
        {insights.slice(0, MAX_VISIBLE).map((insight) => {
          const { Icon, color } = KIND_STYLE[insight.kind];
          return (
            <View
              key={insight.id}
              style={neoShadow(dark, 2)}
              className="flex-row items-start gap-3 rounded-xl border-2 border-border dark:border-border-dark bg-card dark:bg-card-dark p-3"
            >
              <Icon size={20} color={uiColor(color, dark)} />
              <Body className="flex-1">{t(insight.key, insight.params)}</Body>
              <Pressable
                accessibilityRole="button"
                accessibilityLabel={t('coach.dismiss')}
                onPress={() => void dismiss(insight)}
                className="-m-1 p-1 active:opacity-60"
              >
                <X size={18} color={uiColor('muted', dark)} />
              </Pressable>
            </View>
          );
        })}
      </View>
    </>
  );
}
