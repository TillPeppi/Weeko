/**
 * Training import: a copyable AI prompt turns a free-text workout description
 * into JSON (schema: src/schemas/trainingImport.ts); pasting the answer here
 * validates it (localized path errors), previews the sessions and imports them
 * as finished workouts. Unknown exercises are created on import.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { ClipboardCopy, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Body, Label, Muted, SectionTitle, Subtitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import {
  importExerciseLabel,
  parseTrainingImport,
  TRAINING_IMPORT_EXAMPLE,
  type TrainingImportIssue,
} from '@/domain/parseTrainingImport';
import type { TrainingImportParsed } from '@/schemas/trainingImport';
import { importTrainingSessions, unknownImportExercises } from '@/db/repos/trainingRepo';
import { listEquipment, listExercises } from '@/db/repos/exerciseRepo';
import { copyOrShareText } from '@/utils/copyText';
import { dateFnsLocale } from '@/i18n';

type Phase = 'input' | 'preview';

export default function TrainingImportScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [phase, setPhase] = useState<Phase>('input');
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<TrainingImportIssue[]>([]);
  const [draft, setDraft] = useState<TrainingImportParsed | null>(null);
  const [newExercises, setNewExercises] = useState<string[]>([]);
  const [exerciseNames, setExerciseNames] = useState<string[]>([]);
  const [equipmentNames, setEquipmentNames] = useState<string[]>([]);
  const [applying, setApplying] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  useEffect(() => {
    void listExercises().then((list) => setExerciseNames(list.map((e) => e.name)));
    void listEquipment().then((list) => setEquipmentNames(list.map((e) => e.name)));
  }, []);

  const prompt = useMemo(() => {
    const today = format(new Date(), 'yyyy-MM-dd');
    return [
      t('training.import.prompt.intro'),
      TRAINING_IMPORT_EXAMPLE,
      t('training.import.prompt.rules', {
        date: today,
        exercises: exerciseNames.join(', '),
        equipment: equipmentNames.join(', '),
      }),
    ].join('\n\n');
  }, [t, exerciseNames, equipmentNames]);

  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 2500);
  };

  const copyPrompt = async () => {
    const outcome = await copyOrShareText(prompt);
    showFlash(t(`training.import.prompt.${outcome}`));
  };

  const validate = async (text: string) => {
    const result = parseTrainingImport(text);
    if (result.ok) {
      setDraft(result.data);
      setNewExercises(await unknownImportExercises(result.data));
      setErrors([]);
      setPhase('preview');
    } else {
      setErrors(result.errors);
    }
  };

  const goBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(tabs)/training');
  };

  const apply = async () => {
    if (!draft) return;
    setApplying(true);
    try {
      await importTrainingSessions(draft);
      goBack();
    } finally {
      setApplying(false);
    }
  };

  const totalSets = draft
    ? draft.sessions.reduce(
        (sum, session) =>
          sum + session.exercises.reduce((inner, exercise) => inner + exercise.sets.length, 0),
        0
      )
    : 0;

  return (
    <Screen>
      <View className="flex-row items-center justify-between pt-2">
        <Title>{t('training.import.title')}</Title>
        <Pressable accessibilityRole="button" onPress={goBack} className="p-2 active:opacity-60">
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      <Subtitle className="mt-1">{t('training.import.subtitle')}</Subtitle>
      {flash && <Muted className="mt-2 text-success dark:text-success-dark">{flash}</Muted>}

      {phase === 'input' && (
        <View className="mt-5 gap-4">
          <View>
            <Label>{t('training.import.pasteLabel')}</Label>
            <TextInput
              multiline
              value={jsonText}
              onChangeText={setJsonText}
              placeholder={t('training.import.pastePlaceholder')}
              placeholderTextColor="#a49d8e"
              autoCapitalize="none"
              autoCorrect={false}
              className="min-h-40 rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-3 font-mono text-sm text-ink dark:text-ink-dark"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
          <Button
            title={t('training.import.validate')}
            onPress={() => void validate(jsonText)}
            disabled={jsonText.trim() === ''}
          />

          {errors.length > 0 && (
            <Card className="border-danger dark:border-danger-dark">
              <SectionTitle className="text-danger dark:text-danger-dark">
                {t('training.import.errorsTitle')}
              </SectionTitle>
              <View className="mt-2 gap-1.5">
                {errors.map((issue, index) => (
                  <Body key={`${issue.path}-${index}`} className="text-sm">
                    {issueLocation(issue, t)}
                    {t(issue.key)}
                  </Body>
                ))}
              </View>
            </Card>
          )}

          <Card>
            <SectionTitle>{t('training.import.prompt.title')}</SectionTitle>
            <Muted className="mt-1">{t('training.import.prompt.hint')}</Muted>
            <Button
              title={t('training.import.prompt.copy')}
              variant="secondary"
              icon={<ClipboardCopy size={18} color={uiColor('muted', dark)} />}
              onPress={() => void copyPrompt()}
              className="mt-3 self-start"
            />
          </Card>
        </View>
      )}

      {phase === 'preview' && draft && (
        <View className="mt-5 gap-4 pb-6">
          <SectionTitle style={TABULAR}>
            {t('training.import.preview.title')} ·{' '}
            {t('training.import.preview.summary', {
              sessions: draft.sessions.length,
              sets: totalSets,
            })}
          </SectionTitle>

          {newExercises.length > 0 && (
            <Card className="border-warning dark:border-warning-dark">
              <Body className="text-sm">
                {t('training.import.preview.newExercisesHint', {
                  names: newExercises.join(', '),
                })}
              </Body>
            </Card>
          )}

          {draft.sessions.map((session, index) => (
            <Card key={`${session.date}-${index}`}>
              <View className="flex-row items-center justify-between">
                <Body className="font-semibold">{session.title}</Body>
                <Muted style={TABULAR}>
                  {format(parseISO(session.date), 'EEE, d. MMM', { locale: dateFnsLocale() })}
                  {session.start ? ` · ${session.start}` : ''}
                  {session.durationMinutes
                    ? ` · ${t('training.duration', { minutes: session.durationMinutes })}`
                    : ''}
                </Muted>
              </View>
              <View className="mt-2 gap-1">
                {session.exercises.map((exercise, exerciseIndex) => (
                  <View key={exerciseIndex} className="flex-row flex-wrap items-center gap-1.5">
                    <Body className="text-sm">{exercise.name}</Body>
                    {exercise.equipment && (
                      <Muted className="text-sm">· {exercise.equipment}</Muted>
                    )}
                    <Muted className="text-sm" style={TABULAR}>
                      {exercise.sets.length > 0
                        ? exercise.sets.map(setSummary).join(' · ')
                        : t('training.import.preview.noSets')}
                    </Muted>
                    {isNewExercise(importExerciseLabel(exercise.name, exercise.equipment), newExercises) && (
                      <View className="rounded-full border border-warning dark:border-warning-dark px-2 py-0.5">
                        <Muted className="text-xs text-warning dark:text-warning-dark">
                          {t('training.import.preview.newExercise')}
                        </Muted>
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </Card>
          ))}

          <View className="flex-row gap-3">
            <Button
              title={t('common.back')}
              variant="secondary"
              onPress={() => setPhase('input')}
              className="flex-1"
            />
            <Button
              title={t('training.import.preview.apply')}
              onPress={() => void apply()}
              loading={applying}
              className="flex-1"
            />
          </View>
        </View>
      )}
    </Screen>
  );
}

function setSummary(set: { reps?: number; weightKg?: number }): string {
  if (set.reps !== undefined && set.weightKg !== undefined) return `${set.reps}×${set.weightKg} kg`;
  if (set.reps !== undefined) return `${set.reps}×`;
  if (set.weightKg !== undefined) return `${set.weightKg} kg`;
  return '—';
}

function isNewExercise(name: string, newExercises: string[]): boolean {
  const lower = name.trim().toLowerCase();
  return newExercises.some((candidate) => candidate.toLowerCase() === lower);
}

function issueLocation(
  issue: TrainingImportIssue,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (issue.session !== undefined && issue.exercise !== undefined && issue.set !== undefined) {
    return `${t('training.import.atSet', { session: issue.session, exercise: issue.exercise, set: issue.set })}: `;
  }
  if (issue.session !== undefined && issue.exercise !== undefined) {
    return `${t('training.import.atExercise', { session: issue.session, exercise: issue.exercise })}: `;
  }
  if (issue.session !== undefined) {
    return `${t('training.import.atSession', { session: issue.session })}: `;
  }
  return '';
}
