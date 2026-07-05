/**
 * Workout session screen (§6.5): log sets per exercise (reps, added weight,
 * check off). Sets are prefilled from the last session of the same exercise
 * and the previous values are shown ("Letztes Mal: 3×8 @ +10 kg").
 * Live extras while active: elapsed-time clock, rest countdown after each
 * checked set (90 s, +30 s/skip) and total volume (Σ reps × kg of done sets).
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { CheckSquare, Link2, Link2Off, Plus, Square, Timer, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { ExercisePicker } from '@/components/training/ExercisePicker';
import { ExercisePictogram } from '@/components/training/ExercisePictogram';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field } from '@/components/ui/Field';
import { Body, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { listExercises } from '@/db/repos/exerciseRepo';
import {
  deleteSetLog,
  getSession,
  lastSetsForExercise,
  listSessionTemplates,
  listSetLogs,
  resolveTemplateExercises,
  setExerciseSupersetGroup,
  upsertSetLog,
} from '@/db/repos/trainingRepo';
import type { Exercise, SetLog, WorkoutSession } from '@/db/schema';
import { nextSupersetGroup, supersetView } from '@/domain/supersets';
import { formatClock } from '@/domain/time';
import { useTrainingStore } from '@/stores/trainingStore';

/** default rest between sets; extendable in 30-s steps from the banner */
const REST_SECONDS = 90;

interface SetDraft {
  id?: number;
  reps: string;
  weightKg: string;
  done: boolean;
}

interface ExerciseSection {
  exerciseId: number;
  name: string;
  slug: string | null;
  isWeighted: boolean;
  lastSummary: string | null;
  sets: SetDraft[];
  /** superset grouping (see domain/supersets); null = standalone */
  supersetGroup: number | null;
}

export default function SessionScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const params = useLocalSearchParams<{ id: string }>();
  const sessionId = Number(params.id);
  const training = useTrainingStore();

  const [session, setSession] = useState<WorkoutSession | null>(null);
  const [sections, setSections] = useState<ExerciseSection[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [pickingExercise, setPickingExercise] = useState(false);
  const [confirmAbort, setConfirmAbort] = useState(false);
  const [nowTick, setNowTick] = useState(() => Date.now());
  const [restEndsAt, setRestEndsAt] = useState<number | null>(null);

  const readOnly = session?.status !== 'active';

  // 1-s tick drives the elapsed clock and the rest countdown
  useEffect(() => {
    if (readOnly) return;
    const timer = setInterval(() => setNowTick(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [readOnly]);

  const restRemaining = restEndsAt ? Math.ceil((restEndsAt - nowTick) / 1000) : null;
  useEffect(() => {
    if (restRemaining !== null && restRemaining <= 0) setRestEndsAt(null);
  }, [restRemaining]);

  const elapsedSeconds = session
    ? ((session.endedAt ? Date.parse(session.endedAt) : nowTick) -
        Date.parse(session.startedAt)) /
      1000
    : 0;

  // Σ reps × kg over checked-off sets (only sets that carry both values)
  const volumeKg = sections.reduce(
    (sum, section) =>
      sum +
      section.sets.reduce((acc, set) => {
        if (!set.done || set.reps === '' || set.weightKg === '') return acc;
        const reps = Number(set.reps);
        const weight = Number(set.weightKg.replace(',', '.'));
        return Number.isFinite(reps) && Number.isFinite(weight) ? acc + reps * weight : acc;
      }, 0),
    0
  );
  // header set counter ("Dark Focus"): only for the store-tracked active session
  const isStoreActive = training.activeSession?.id === sessionId;
  const progress = isStoreActive ? training.activeProgress : null;

  const summarize = (sets: SetLog[]): string | null => {
    if (sets.length === 0) return null;
    const reps = sets[0].reps ?? 0;
    const weight = sets[sets.length - 1].weightKg;
    return weight
      ? t('training.lastTimeSet', { sets: sets.length, reps, weight })
      : t('training.lastTimeSetNoWeight', { sets: sets.length, reps });
  };

  const buildSection = useCallback(
    async (exercise: Exercise, existing: SetLog[]): Promise<ExerciseSection> => {
      const last = await lastSetsForExercise(exercise.id, sessionId);
      const sets: SetDraft[] =
        existing.length > 0
          ? existing.map((s) => ({
              id: s.id,
              reps: s.reps === null ? '' : String(s.reps),
              weightKg: s.weightKg === null ? '' : String(s.weightKg),
              done: s.done,
            }))
          : [];
      return {
        exerciseId: exercise.id,
        name: exercise.name,
        slug: exercise.slug,
        isWeighted: exercise.isWeighted,
        lastSummary: summarize(last),
        sets,
        supersetGroup: existing.find((s) => s.supersetGroup !== null)?.supersetGroup ?? null,
      };
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [sessionId]
  );

  useEffect(() => {
    void (async () => {
      const [loaded, logs, allExercises] = await Promise.all([
        getSession(sessionId),
        listSetLogs(sessionId),
        listExercises(),
      ]);
      if (!loaded) {
        router.back();
        return;
      }
      setSession(loaded);
      setExercises(allExercises);

      const byExercise = new Map<number, SetLog[]>();
      for (const log of logs) {
        const list = byExercise.get(log.exerciseId) ?? [];
        list.push(log);
        byExercise.set(log.exerciseId, list);
      }

      const built: ExerciseSection[] = [];

      // sections for already-logged exercises
      for (const [exerciseId, sets] of byExercise) {
        const exercise = allExercises.find((e) => e.id === exerciseId);
        if (exercise) built.push(await buildSection(exercise, sets));
      }

      // template exercises without logs yet (only while active)
      if (loaded.templateId && loaded.status === 'active') {
        const templates = await listSessionTemplates();
        const template = templates.find((tpl) => tpl.id === loaded.templateId);
        if (template) {
          const items = await resolveTemplateExercises(template);
          for (const item of items) {
            if (byExercise.has(item.exerciseId)) continue;
            const exercise = allExercises.find((e) => e.id === item.exerciseId);
            if (!exercise) continue;
            const section = await buildSection(exercise, []);
            const last = await lastSetsForExercise(item.exerciseId, sessionId);
            section.sets = Array.from({ length: item.targetSets }, (_, i) => ({
              reps: last[i]?.reps != null ? String(last[i].reps) : String(item.targetReps),
              weightKg: last[i]?.weightKg != null ? String(last[i].weightKg) : '',
              done: false,
            }));
            built.push(section);
          }
        }
      }

      setSections(built);
      await useTrainingStore.getState().refreshProgress();
    })();
  }, [sessionId, buildSection]);

  const persistSet = async (sectionIndex: number, setIndex: number, patch: Partial<SetDraft>) => {
    const section = sections[sectionIndex];
    const current = { ...section.sets[setIndex], ...patch };
    // checking a set off starts the rest countdown — but inside a superset only
    // after the last exercise of the group (no rest between paired exercises)
    if (patch.done === true) {
      const slot = supersetView(sections.map((s) => s.supersetGroup))[sectionIndex];
      if (slot.isLastInGroup) setRestEndsAt(Date.now() + REST_SECONDS * 1000);
    } else if (patch.done === false) setRestEndsAt(null);
    const id = await upsertSetLog({
      id: current.id,
      sessionId,
      exerciseId: section.exerciseId,
      setIndex,
      reps: current.reps === '' ? null : Number(current.reps),
      weightKg: current.weightKg === '' ? null : Number(current.weightKg.replace(',', '.')),
      done: current.done,
      supersetGroup: section.supersetGroup,
    });
    setSections((prev) =>
      prev.map((s, si) =>
        si === sectionIndex
          ? { ...s, sets: s.sets.map((x, xi) => (xi === setIndex ? { ...current, id } : x)) }
          : s
      )
    );
    await training.refreshProgress();
  };

  const addSet = async (sectionIndex: number) => {
    const section = sections[sectionIndex];
    const previous = section.sets[section.sets.length - 1];
    const last = await lastSetsForExercise(section.exerciseId, sessionId);
    const fromLast = last[section.sets.length];
    const draft: SetDraft = {
      reps: previous?.reps ?? (fromLast?.reps != null ? String(fromLast.reps) : ''),
      weightKg: previous?.weightKg ?? (fromLast?.weightKg != null ? String(fromLast.weightKg) : ''),
      done: false,
    };
    setSections((prev) =>
      prev.map((s, si) => (si === sectionIndex ? { ...s, sets: [...s.sets, draft] } : s))
    );
  };

  const removeSet = async (sectionIndex: number, setIndex: number) => {
    const section = sections[sectionIndex];
    const target = section.sets[setIndex];
    if (target.id) await deleteSetLog(target.id);
    setSections((prev) =>
      prev.map((s, si) =>
        si === sectionIndex ? { ...s, sets: s.sets.filter((_, xi) => xi !== setIndex) } : s
      )
    );
    await training.refreshProgress();
  };

  const addExercise = async (exercise: Exercise) => {
    setPickingExercise(false);
    if (sections.some((s) => s.exerciseId === exercise.id)) return;
    const section = await buildSection(exercise, []);
    const last = await lastSetsForExercise(exercise.id, sessionId);
    section.sets =
      last.length > 0
        ? last.map((s) => ({
            reps: s.reps === null ? '' : String(s.reps),
            weightKg: s.weightKg === null ? '' : String(s.weightKg),
            done: false,
          }))
        : [{ reps: '', weightKg: '', done: false }];
    setSections((prev) => [...prev, section]);
  };

  /** Persists a set of {index → group} changes and mirrors them into state. */
  const applyGroups = async (updates: { index: number; group: number | null }[]) => {
    for (const u of updates) {
      await setExerciseSupersetGroup(sessionId, sections[u.index].exerciseId, u.group);
    }
    setSections((prev) =>
      prev.map((s, i) => {
        const u = updates.find((x) => x.index === i);
        return u ? { ...s, supersetGroup: u.group } : s;
      })
    );
  };

  /** Groups an exercise with the one below it into a shared superset. */
  const linkWithNext = (index: number) => {
    const cur = sections[index];
    const next = sections[index + 1];
    if (!next) return;
    const group =
      cur.supersetGroup ?? next.supersetGroup ?? nextSupersetGroup(sections.map((s) => s.supersetGroup));
    const absorb = next.supersetGroup; // if next was in another group, pull its members in too
    const updates: { index: number; group: number | null }[] = [];
    sections.forEach((s, i) => {
      if (i === index || i === index + 1 || (absorb !== null && s.supersetGroup === absorb)) {
        if (s.supersetGroup !== group) updates.push({ index: i, group });
      }
    });
    void applyGroups(updates);
  };

  /** Dissolves a whole superset group (all its exercises become standalone). */
  const dissolveGroup = (group: number) => {
    const updates = sections
      .map((s, i) => ({ s, i }))
      .filter(({ s }) => s.supersetGroup === group)
      .map(({ i }) => ({ index: i, group: null }));
    void applyGroups(updates);
  };

  const finish = async (aborted: boolean) => {
    await training.finish(sessionId, aborted);
    router.back();
  };

  if (!session) return <Screen>{null}</Screen>;

  const supersets = supersetView(sections.map((s) => s.supersetGroup));

  return (
    <Screen>
      <View className="flex-row items-center justify-between pt-2">
        <View className="flex-1 pr-2">
          <Title numberOfLines={1}>{session.title}</Title>
          <Muted style={TABULAR} className="mt-0.5 font-semibold">
            <Muted style={TABULAR} className="font-semibold text-accent dark:text-accent-dark">
              {formatClock(elapsedSeconds)}
            </Muted>
            {progress && progress.total > 0
              ? ` · ${t('today.setProgress', { current: progress.done, total: progress.total })}`
              : ''}
            {volumeKg > 0 ? ` · ${t('training.volume', { kg: Math.round(volumeKg) })}` : ''}
          </Muted>
        </View>
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="p-2 active:opacity-60">
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>

      {!readOnly && restRemaining !== null && restRemaining > 0 && (
        <Card elevated className="mt-3">
          <View className="flex-row items-center justify-between gap-3">
            <View className="flex-row items-center gap-2">
              <Timer size={20} color={uiColor('accent', dark)} />
              <SectionTitle>{t('training.rest')}</SectionTitle>
            </View>
            <Body style={TABULAR} className="text-2xl font-bold text-accent dark:text-accent-dark">
              {formatClock(restRemaining)}
            </Body>
            <View className="flex-row items-center gap-2">
              <Button
                title={t('training.restPlus30')}
                variant="secondary"
                size="sm"
                onPress={() => setRestEndsAt((v) => (v ? v + 30_000 : v))}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setRestEndsAt(null)}
                className="p-1.5 active:opacity-60"
              >
                <X size={18} color={uiColor('muted', dark)} />
              </Pressable>
            </View>
          </View>
        </Card>
      )}

      <View className="mt-4 gap-4">
        {sections.map((section, sectionIndex) => {
          const slot = supersets[sectionIndex];
          const next = sections[sectionIndex + 1];
          const sameGroupAsNext =
            !!next && section.supersetGroup !== null && section.supersetGroup === next.supersetGroup;
          return (
          <Card
            key={section.exerciseId}
            className={slot.label ? 'border-accent dark:border-accent-dark' : ''}
          >
            <View className="flex-row items-center gap-3">
              <ExercisePictogram slug={section.slug} size={40} />
              <View className="flex-1">
                <View className="flex-row items-center gap-2">
                  <SectionTitle>{section.name}</SectionTitle>
                  {slot.label && (
                    <View className="rounded-full bg-accent px-2 py-0.5 dark:bg-accent-dark">
                      <Body className="text-xs font-bold uppercase text-surface dark:text-surface-dark">
                        {t('training.supersetLabel', { letter: slot.label })}
                      </Body>
                    </View>
                  )}
                </View>
                <Muted className="mt-0.5" style={TABULAR}>
                  {section.lastSummary
                    ? t('training.lastTime', { summary: section.lastSummary })
                    : t('training.noLastTime')}
                </Muted>
              </View>
            </View>

            <View className="mt-3 gap-2">
              {section.sets.map((set, setIndex) => {
                // "Dark Focus": the next unchecked set is the active one
                const isActiveSet =
                  !readOnly && !set.done && section.sets.findIndex((s) => !s.done) === setIndex;
                return (
                  <View key={setIndex} className="flex-row items-center gap-2">
                    <Muted
                      style={TABULAR}
                      className={`w-14 ${isActiveSet ? 'font-bold text-accent dark:text-accent-dark' : ''}`}
                    >
                      {t('training.set', { index: setIndex + 1 })}
                    </Muted>
                    <Field
                      className="flex-1"
                      style={TABULAR}
                      value={set.reps}
                      onChangeText={(reps) => void persistSet(sectionIndex, setIndex, { reps })}
                      keyboardType="numeric"
                      placeholder={t('training.reps')}
                      editable={!readOnly}
                      maxLength={4}
                    />
                    <Field
                      className="flex-1"
                      style={TABULAR}
                      value={set.weightKg}
                      onChangeText={(weightKg) =>
                        void persistSet(sectionIndex, setIndex, { weightKg })
                      }
                      keyboardType="decimal-pad"
                      placeholder={section.isWeighted ? `+${t('common.kg')}` : t('common.kg')}
                      editable={!readOnly}
                      maxLength={6}
                    />
                    {!readOnly && (
                      <>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() =>
                            void persistSet(sectionIndex, setIndex, { done: !set.done })
                          }
                          className="p-1 active:opacity-60"
                        >
                          {set.done ? (
                            <CheckSquare size={24} color={uiColor('success', dark)} />
                          ) : (
                            <Square
                              size={24}
                              color={isActiveSet ? uiColor('accent', dark) : uiColor('muted', dark)}
                            />
                          )}
                        </Pressable>
                        <Pressable
                          accessibilityRole="button"
                          onPress={() => void removeSet(sectionIndex, setIndex)}
                          className="p-1 active:opacity-60"
                        >
                          <X size={18} color={uiColor('muted', dark)} />
                        </Pressable>
                      </>
                    )}
                  </View>
                );
              })}
            </View>

            {!readOnly && (
              <View className="mt-2 flex-row flex-wrap items-center gap-x-3 gap-y-1">
                <Button
                  title={t('training.addSet')}
                  variant="ghost"
                  size="sm"
                  icon={<Plus size={14} color={uiColor('accent', dark)} />}
                  onPress={() => void addSet(sectionIndex)}
                  className="self-start"
                />
                {next && !sameGroupAsNext && (
                  <Button
                    title={t('training.linkSuperset')}
                    variant="ghost"
                    size="sm"
                    icon={<Link2 size={14} color={uiColor('accent', dark)} />}
                    onPress={() => linkWithNext(sectionIndex)}
                    className="self-start"
                  />
                )}
                {slot.label && section.supersetGroup !== null && (
                  <Button
                    title={t('training.unlinkSuperset')}
                    variant="ghost"
                    size="sm"
                    icon={<Link2Off size={14} color={uiColor('muted', dark)} />}
                    onPress={() => dissolveGroup(section.supersetGroup as number)}
                    className="self-start"
                  />
                )}
              </View>
            )}
          </Card>
          );
        })}

        {!readOnly && (
          <>
            {pickingExercise || sections.length === 0 ? (
              <Card>
                {sections.length === 0 ? (
                  <>
                    <SectionTitle>{t('training.emptySessionTitle')}</SectionTitle>
                    <Muted className="mt-1">{t('training.emptySessionBody')}</Muted>
                  </>
                ) : (
                  <SectionTitle>{t('training.addExercise')}</SectionTitle>
                )}
                <View className="mt-3">
                  <ExercisePicker
                    exercises={exercises}
                    excludeIds={sections.map((s) => s.exerciseId)}
                    sessionId={sessionId}
                    onPick={(exercise) => void addExercise(exercise)}
                  />
                </View>
                {sections.length > 0 && (
                  <Button
                    title={t('common.cancel')}
                    variant="ghost"
                    size="sm"
                    onPress={() => setPickingExercise(false)}
                    className="mt-2 self-start"
                  />
                )}
              </Card>
            ) : (
              <Button
                title={t('training.addExercise')}
                variant="secondary"
                icon={<Plus size={16} color={uiColor('muted', dark)} />}
                onPress={() => setPickingExercise(true)}
              />
            )}

            <View className="flex-row gap-3 pb-6">
              <Button
                title={t('training.abort')}
                variant="secondary"
                onPress={() => setConfirmAbort(true)}
                className="flex-1"
              />
              <Button title={t('training.finish')} onPress={() => void finish(false)} className="flex-1" />
            </View>
          </>
        )}
      </View>

      <ConfirmDialog
        visible={confirmAbort}
        title={t('training.abort')}
        message={t('training.abortConfirm')}
        destructive
        onConfirm={() => void finish(true)}
        onCancel={() => setConfirmAbort(false)}
      />
    </Screen>
  );
}
