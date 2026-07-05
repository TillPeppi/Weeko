/**
 * Exercise picker for workout sessions: searchable catalog grouped by muscle
 * group, every entry with its pictogram and the last logged result — so a free
 * session starts from a browsable catalog instead of a bare button.
 */
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import type { Exercise } from '@/db/schema';
import { MUSCLE_GROUPS } from '@/domain/types';
import { lastSetsForExercise } from '@/db/repos/trainingRepo';
import { uiColor } from '@/constants/uiColors';
import { Field } from '@/components/ui/Field';
import { Body, Label, Muted, TABULAR } from '@/components/ui/Text';
import { ExercisePictogram } from './ExercisePictogram';

interface Props {
  exercises: Exercise[];
  /** already part of the session — hidden from the list */
  excludeIds: number[];
  /** current session, excluded from "last time" lookups */
  sessionId: number;
  onPick: (exercise: Exercise) => void;
}

/** null muscle group (user-created exercises) sorts last under its own label */
const GROUP_ORDER = [...MUSCLE_GROUPS, 'other'] as const;

export function ExercisePicker({ exercises, excludeIds, sessionId, onPick }: Props) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [query, setQuery] = useState('');
  const [summaries, setSummaries] = useState<Map<number, string>>(new Map());

  // "last time" lines, loaded once per exercise set (local SQLite, cheap)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next = new Map<number, string>();
      for (const exercise of exercises) {
        const sets = await lastSetsForExercise(exercise.id, sessionId);
        if (sets.length === 0) continue;
        const reps = sets[0].reps ?? 0;
        const weight = sets[sets.length - 1].weightKg;
        next.set(
          exercise.id,
          weight
            ? t('training.lastTimeSet', { sets: sets.length, reps, weight })
            : t('training.lastTimeSetNoWeight', { sets: sets.length, reps })
        );
      }
      if (!cancelled) setSummaries(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [exercises, sessionId, t]);

  const groups = useMemo(() => {
    const needle = query.trim().toLowerCase();
    const visible = exercises.filter(
      (e) => !excludeIds.includes(e.id) && (needle === '' || e.name.toLowerCase().includes(needle))
    );
    return GROUP_ORDER.map((group) => ({
      group,
      items: visible.filter((e) => (e.muscleGroup ?? 'other') === group),
    })).filter((g) => g.items.length > 0);
  }, [exercises, excludeIds, query]);

  return (
    <View>
      <Field
        value={query}
        onChangeText={setQuery}
        placeholder={t('training.searchExercise')}
        autoCorrect={false}
      />
      {groups.length === 0 && <Muted className="mt-3">{t('training.searchNoResults')}</Muted>}
      {groups.map(({ group, items }) => (
        <View key={group} className="mt-3">
          <Label>{t(`training.muscleGroups.${group}`)}</Label>
          <View className="gap-1">
            {items.map((exercise) => (
              <Pressable
                key={exercise.id}
                accessibilityRole="button"
                onPress={() => onPick(exercise)}
                className="flex-row items-center gap-3 rounded-xl border border-border px-2 py-1.5 active:opacity-60 dark:border-border-dark"
              >
                <ExercisePictogram slug={exercise.slug} size={40} />
                <View className="flex-1">
                  <Body className="font-semibold">{exercise.name}</Body>
                  <Muted style={TABULAR}>
                    {summaries.has(exercise.id)
                      ? t('training.lastUsed', { summary: summaries.get(exercise.id) })
                      : t('training.neverTrained')}
                  </Muted>
                </View>
              </Pressable>
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}
