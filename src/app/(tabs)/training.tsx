/**
 * Training tab (§6.5): start sessions (from template or ad hoc), continue the
 * active one, browse history. Works fully offline (local SQLite).
 */
import { useCallback, useState } from 'react';
import { View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Dumbbell, FileJson, Play } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { TrainingDashboard } from '@/components/training/TrainingDashboard';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { UI_COLORS, uiColor } from '@/constants/uiColors';
import { listSessions, trainingDayDates } from '@/db/repos/trainingRepo';
import type { WorkoutSession } from '@/db/schema';
import { useTrainingStore } from '@/stores/trainingStore';
import { dateFnsLocale } from '@/i18n';

export default function TrainingScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const store = useTrainingStore();
  const [history, setHistory] = useState<WorkoutSession[]>([]);
  const [trainedDates, setTrainedDates] = useState<string[]>([]);

  useFocusEffect(
    useCallback(() => {
      void store.hydrate();
      void listSessions().then(setHistory);
      void trainingDayDates().then(setTrainedDates);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const startFromTemplate = async (templateId: string, title: string) => {
    const id = await store.start({ title, templateId });
    router.push(`/session/${id}`);
  };

  const startAdhoc = async () => {
    const id = await store.start({ title: t('training.adhoc') });
    router.push(`/session/${id}`);
  };

  return (
    <Screen>
      <Title>{t('training.title')}</Title>

      {store.activeSession && (
        <Card elevated className="mt-4 border-accent dark:border-accent-dark">
          <SectionTitle>{t('training.active')}</SectionTitle>
          <Body className="mt-1">{store.activeSession.title}</Body>
          <Muted style={TABULAR}>
            {t('training.startedAt', {
              time: format(parseISO(store.activeSession.startedAt), 'HH:mm', {
                locale: dateFnsLocale(),
              }),
            })}
            {store.activeProgress && store.activeProgress.total > 0
              ? ` · ${t('today.setProgress', {
                  current: store.activeProgress.done,
                  total: store.activeProgress.total,
                })}`
              : ''}
          </Muted>
          <Button
            title={t('today.continueTraining')}
            onPress={() => router.push(`/session/${store.activeSession!.id}`)}
            className="mt-3 self-start"
          />
        </Card>
      )}

      <TrainingDashboard dates={trainedDates} />

      <SectionTitle className="mt-6">{t('training.templates')}</SectionTitle>
      <View className="mt-2 gap-2">
        {store.templates.map((template) => (
          <Card key={template.id}>
            <View className="flex-row items-center justify-between gap-3">
              <View className="flex-1 flex-row items-center gap-3">
                <Dumbbell size={20} color={uiColor('muted', dark)} />
                <View className="flex-1">
                  <Body className="font-semibold">
                    {template.nameKey.startsWith('seeds.') ? t(template.nameKey) : template.nameKey}
                  </Body>
                  <Muted>
                    {template.items.map((item) => item.exerciseName).join(' · ')}
                  </Muted>
                </View>
              </View>
              <Button
                title={t('training.start')}
                size="sm"
                icon={<Play size={14} color={UI_COLORS.ink.light} />}
                onPress={() =>
                  void startFromTemplate(
                    template.id,
                    template.nameKey.startsWith('seeds.') ? t(template.nameKey) : template.nameKey
                  )
                }
              />
            </View>
          </Card>
        ))}
        <Button title={t('training.adhoc')} variant="secondary" onPress={() => void startAdhoc()} />
        <Button
          title={t('training.import.cta')}
          variant="ghost"
          icon={<FileJson size={18} color={uiColor('accent', dark)} />}
          onPress={() => router.push('/training-import')}
        />
      </View>

      <SectionTitle className="mt-6">{t('training.history')}</SectionTitle>
      <View className="mt-2 gap-2 pb-6">
        {history.length === 0 ? (
          <Muted>{t('training.historyEmpty')}</Muted>
        ) : (
          history.map((session) => (
            <Card key={session.id} onPress={() => router.push(`/session/${session.id}`)}>
              <View className="flex-row items-center justify-between">
                <View>
                  <Body className="font-semibold">{session.title}</Body>
                  <Muted style={TABULAR}>
                    {format(parseISO(session.startedAt), 'EEE, d. MMM yyyy · HH:mm', {
                      locale: dateFnsLocale(),
                    })}
                  </Muted>
                </View>
                {session.endedAt && (
                  <Muted style={TABULAR}>
                    {t('training.duration', {
                      minutes: Math.round(
                        (parseISO(session.endedAt).getTime() -
                          parseISO(session.startedAt).getTime()) /
                          60000
                      ),
                    })}
                  </Muted>
                )}
              </View>
            </Card>
          ))
        )}
      </View>
    </Screen>
  );
}
