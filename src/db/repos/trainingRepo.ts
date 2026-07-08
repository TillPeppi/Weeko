import { newId } from '../id';
import { insertRow, insertRows, nowIso, sb, selectRows, toRow } from '../sb';
import {
  type Equipment,
  type Exercise,
  type SessionTemplate,
  type SetLog,
  type WorkoutSession,
} from '../schema';
import type { SessionTemplateSeed } from '../seeds';
import type { TrainingImportParsed } from '@/schemas/trainingImport';
import { importExerciseLabel } from '@/domain/parseTrainingImport';

export async function listSessionTemplates(): Promise<SessionTemplate[]> {
  return selectRows<SessionTemplate>('session_template', (q) => q.order('id', { ascending: true }));
}

export async function seedSessionTemplates(seeds: SessionTemplateSeed[]): Promise<void> {
  const existing = await listSessionTemplates();
  if (existing.length > 0) return;
  await insertRows(
    'session_template',
    seeds.map((seed) => ({ ...seed, id: newId(), updatedAt: nowIso() }))
  );
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  const rows = await selectRows<WorkoutSession>('workout_session', (q) =>
    q.eq('status', 'active').order('started_at', { ascending: false }).limit(1)
  );
  return rows[0];
}

export async function startSession(values: {
  title: string;
  blockId?: string | null;
  templateId?: string | null;
}): Promise<string> {
  // only one active session at a time — abort stale ones
  const abort = await sb()
    .from('workout_session')
    .update(toRow({ status: 'aborted', endedAt: nowIso(), updatedAt: nowIso() }))
    .eq('status', 'active');
  if (abort.error) throw abort.error;

  const id = newId();
  await insertRow('workout_session', {
    id,
    title: values.title,
    blockId: values.blockId ?? null,
    templateId: values.templateId ?? null,
    startedAt: nowIso(),
    status: 'active',
    updatedAt: nowIso(),
  });
  return id;
}

export async function finishSession(id: string, aborted = false): Promise<void> {
  const { error } = await sb()
    .from('workout_session')
    .update(toRow({ status: aborted ? 'aborted' : 'done', endedAt: nowIso(), updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function getSession(id: string): Promise<WorkoutSession | undefined> {
  const rows = await selectRows<WorkoutSession>('workout_session', (q) => q.eq('id', id).limit(1));
  return rows[0];
}

export async function listSessions(limit = 30): Promise<WorkoutSession[]> {
  return selectRows<WorkoutSession>('workout_session', (q) =>
    q.neq('status', 'active').order('started_at', { ascending: false }).limit(limit)
  );
}

/** All finished sessions, oldest first — statistics. */
export async function listDoneSessions(): Promise<WorkoutSession[]> {
  return selectRows<WorkoutSession>('workout_session', (q) =>
    q.eq('status', 'done').order('started_at', { ascending: true })
  );
}

export interface StatsSetRow {
  sessionId: string;
  exerciseId: string;
  /** YYYY-MM-DD of the session */
  date: string;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
}

/** All set logs of finished sessions with the session date — statistics. */
export async function listStatsSetRows(): Promise<StatsSetRow[]> {
  const sessions = await listDoneSessions();
  if (sessions.length === 0) return [];
  const dateBySession = new Map(sessions.map((s) => [s.id, s.startedAt.slice(0, 10)]));
  const sets = await selectRows<SetLog>('set_log', (q) =>
    q.in(
      'session_id',
      sessions.map((s) => s.id)
    )
  );
  return sets
    .filter((s) => dateBySession.has(s.sessionId))
    .map((s) => ({
      sessionId: s.sessionId,
      exerciseId: s.exerciseId,
      date: dateBySession.get(s.sessionId)!,
      reps: s.reps,
      weightKg: s.weightKg,
      done: s.done,
    }));
}

/** Distinct YYYY-MM-DD days with a finished session — training dashboard. */
export async function trainingDayDates(): Promise<string[]> {
  const sessions = await listDoneSessions();
  return [...new Set(sessions.map((s) => s.startedAt.slice(0, 10)))];
}

/** Set progress of a session: how many logged sets are checked off. */
export async function sessionSetProgress(
  sessionId: string
): Promise<{ done: number; total: number }> {
  const rows = await selectRows<SetLog>('set_log', (q) => q.eq('session_id', sessionId));
  return { total: rows.length, done: rows.filter((r) => r.done).length };
}

export async function listSetLogs(sessionId: string): Promise<SetLog[]> {
  return selectRows<SetLog>('set_log', (q) =>
    q
      .eq('session_id', sessionId)
      .order('exercise_id', { ascending: true })
      .order('set_index', { ascending: true })
  );
}

export async function upsertSetLog(values: {
  id?: string;
  sessionId: string;
  exerciseId: string;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
  supersetGroup?: number | null;
}): Promise<string> {
  if (values.id) {
    const { error } = await sb()
      .from('set_log')
      .update(
        toRow({
          reps: values.reps,
          weightKg: values.weightKg,
          done: values.done,
          supersetGroup: values.supersetGroup ?? null,
          updatedAt: nowIso(),
        })
      )
      .eq('id', values.id);
    if (error) throw error;
    return values.id;
  }
  const id = newId();
  await insertRow('set_log', {
    ...values,
    id,
    supersetGroup: values.supersetGroup ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return id;
}

export async function deleteSetLog(id: string): Promise<void> {
  const { error } = await sb().from('set_log').delete().eq('id', id);
  if (error) throw error;
}

/** Assigns (or clears) the superset group for every logged set of an exercise in a session. */
export async function setExerciseSupersetGroup(
  sessionId: string,
  exerciseId: string,
  group: number | null
): Promise<void> {
  const { error } = await sb()
    .from('set_log')
    .update(toRow({ supersetGroup: group, updatedAt: nowIso() }))
    .eq('session_id', sessionId)
    .eq('exercise_id', exerciseId);
  if (error) throw error;
}

/**
 * Prefill data: the sets of the most recent finished session containing this
 * exercise ("letztes Mal 3×8 @ +10 kg").
 */
export async function lastSetsForExercise(
  exerciseId: string,
  excludeSessionId?: string
): Promise<SetLog[]> {
  const doneSessions = await listDoneSessions(); // ascending
  const setsForExercise = await selectRows<SetLog>('set_log', (q) =>
    q.eq('exercise_id', exerciseId)
  );
  const sessionIdsWithExercise = new Set(setsForExercise.map((s) => s.sessionId));
  // newest first, first done session (≠ excluded) that contains this exercise
  const lastSession = [...doneSessions]
    .reverse()
    .find((s) => s.id !== excludeSessionId && sessionIdsWithExercise.has(s.id));
  if (!lastSession) return [];
  return setsForExercise
    .filter((s) => s.sessionId === lastSession.id)
    .sort((a, b) => a.setIndex - b.setIndex);
}

/** Resolves template items to exercise ids by name (case-insensitive). */
export async function resolveTemplateExercises(
  template: SessionTemplate
): Promise<{ exerciseId: string; targetSets: number; targetReps: number }[]> {
  const exercises = await selectRows<Exercise>('exercise');
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e.id]));
  const resolved: { exerciseId: string; targetSets: number; targetReps: number }[] = [];
  for (const item of template.items) {
    const id = byName.get(item.exerciseName.toLowerCase());
    if (id !== undefined) {
      resolved.push({ exerciseId: id, targetSets: item.targetSets, targetReps: item.targetReps });
    }
  }
  return resolved;
}

/** Local-naive ISO without timezone suffix (matches imported startedAt format). */
function localNaiveIso(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}:00`;
}

export interface TrainingImportResult {
  sessions: number;
  sets: number;
  /** exercise names that did not exist yet and were created */
  createdExercises: string[];
}

const NAME_EQUIP_SEP = ' ';
function matchKey(name: string, equipment?: string): string {
  const nameLower = name.trim().toLowerCase();
  const equipLower = equipment?.trim().toLowerCase();
  return equipLower ? `${nameLower}${NAME_EQUIP_SEP}${equipLower}` : nameLower;
}

async function existingExerciseKeys(): Promise<{ names: Set<string>; nameEquips: Set<string> }> {
  const [exercises, equipments] = await Promise.all([
    selectRows<Exercise>('exercise'),
    selectRows<Equipment>('equipment'),
  ]);
  const equipNameById = new Map(equipments.map((e) => [e.id, e.name.toLowerCase()]));
  const names = new Set(exercises.map((e) => e.name.toLowerCase()));
  const nameEquips = new Set<string>();
  for (const e of exercises) {
    if (!e.equipmentId) continue;
    const equipName = equipNameById.get(e.equipmentId);
    if (equipName) nameEquips.add(`${e.name.toLowerCase()}${NAME_EQUIP_SEP}${equipName}`);
  }
  return { names, nameEquips };
}

function isKnownExercise(
  keys: { names: Set<string>; nameEquips: Set<string> },
  name: string,
  equipment?: string
): boolean {
  const equipLower = equipment?.trim().toLowerCase();
  return equipLower
    ? keys.nameEquips.has(matchKey(name, equipment))
    : keys.names.has(name.trim().toLowerCase());
}

/** Display labels ("name" or "name · equipment") of import exercises that don't exist yet. */
export async function unknownImportExercises(data: TrainingImportParsed): Promise<string[]> {
  const keys = await existingExerciseKeys();
  const seen = new Set<string>();
  const unknown: string[] = [];
  for (const session of data.sessions) {
    for (const item of session.exercises) {
      if (isKnownExercise(keys, item.name, item.equipment)) continue;
      const key = matchKey(item.name, item.equipment);
      if (seen.has(key)) continue; // dedupe within the import
      seen.add(key);
      unknown.push(importExerciseLabel(item.name, item.equipment));
    }
  }
  return unknown;
}

/**
 * Imports validated sessions as finished workouts: creates missing exercises,
 * one `workout_session` (status done) per entry and all sets as done.
 * `startedAt` is stored as local-naive ISO so the date-based statistics
 * (`startedAt.slice(0, 10)`) hit the intended day. No client transaction with
 * PostgREST — inserted sequentially.
 */
export async function importTrainingSessions(
  data: TrainingImportParsed
): Promise<TrainingImportResult> {
  const result: TrainingImportResult = { sessions: 0, sets: 0, createdExercises: [] };

  const [existing, existingEquipment] = await Promise.all([
    selectRows<Exercise>('exercise'),
    selectRows<Equipment>('equipment'),
  ]);

  const equipIdByName = new Map(existingEquipment.map((e) => [e.name.toLowerCase(), e.id]));
  const equipNameById = new Map(existingEquipment.map((e) => [e.id, e.name.toLowerCase()]));

  const idByName = new Map<string, string>();
  const idByNameEquip = new Map<string, string>();
  for (const e of existing) {
    const nameLower = e.name.toLowerCase();
    if (!idByName.has(nameLower)) idByName.set(nameLower, e.id);
    const equipName = e.equipmentId ? equipNameById.get(e.equipmentId) : undefined;
    if (equipName) idByNameEquip.set(`${nameLower}${NAME_EQUIP_SEP}${equipName}`, e.id);
  }

  const ensureEquipmentId = async (equipName: string | undefined): Promise<string | null> => {
    if (!equipName) return null;
    const lower = equipName.toLowerCase();
    const known = equipIdByName.get(lower);
    if (known !== undefined) return known;
    const id = newId();
    await insertRow('equipment', { id, name: equipName, available: true, updatedAt: nowIso() });
    equipIdByName.set(lower, id);
    equipNameById.set(id, lower);
    return id;
  };

  const ensureExercise = async (
    name: string,
    equipName: string | undefined,
    weighted: boolean
  ): Promise<string> => {
    const nameLower = name.toLowerCase();
    const equipLower = equipName?.toLowerCase();
    const known = equipLower
      ? idByNameEquip.get(`${nameLower}${NAME_EQUIP_SEP}${equipLower}`)
      : idByName.get(nameLower);
    if (known !== undefined) return known;

    const equipmentId = await ensureEquipmentId(equipName);
    const id = newId();
    await insertRow('exercise', { id, name, equipmentId, isWeighted: weighted, updatedAt: nowIso() });
    if (!idByName.has(nameLower)) idByName.set(nameLower, id);
    if (equipLower) idByNameEquip.set(`${nameLower}${NAME_EQUIP_SEP}${equipLower}`, id);
    result.createdExercises.push(importExerciseLabel(name, equipName));
    return id;
  };

  for (const session of data.sessions) {
    const start = session.start ?? '12:00';
    const startedAt = `${session.date}T${start}:00`;
    const endedAt =
      session.durationMinutes !== undefined
        ? localNaiveIso(new Date(Date.parse(startedAt) + session.durationMinutes * 60000))
        : null;
    const sessionId = newId();
    await insertRow('workout_session', {
      id: sessionId,
      title: session.title,
      startedAt,
      endedAt,
      status: 'done',
      updatedAt: nowIso(),
    });
    result.sessions += 1;

    const setRows: Record<string, unknown>[] = [];
    for (const item of session.exercises) {
      const name = item.name.trim();
      const equipName = item.equipment?.trim() || undefined;
      const weighted = item.sets.some((set) => (set.weightKg ?? 0) > 0);
      const exerciseId = await ensureExercise(name, equipName, weighted);

      // Cardio/mobility without countable sets: one placeholder set (null
      // reps/weight) so the exercise still shows; stats skip null-reps sets.
      if (item.sets.length === 0) {
        setRows.push({
          id: newId(),
          sessionId,
          exerciseId,
          setIndex: 1,
          reps: null,
          weightKg: null,
          done: true,
          supersetGroup: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        continue;
      }

      item.sets.forEach((set, index) => {
        setRows.push({
          id: newId(),
          sessionId,
          exerciseId,
          setIndex: index + 1,
          reps: set.reps ?? null,
          weightKg: set.weightKg ?? null,
          done: true,
          supersetGroup: null,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
        result.sets += 1;
      });
    }
    await insertRows('set_log', setRows);
  }

  return result;
}

export interface StatsSetRowWithSessionIndex extends StatsSetRow {
  sessionIndex: number; // 1st, 2nd, 3rd session with this exercise
  exerciseName: string;
}

/**
 * All done sets with session index per exercise (for weight gain calculations).
 * Session index = 1 for the first session with this exercise, 2 for the second, etc.
 */
export async function listStatsSetRowsWithSessionIndex(): Promise<StatsSetRowWithSessionIndex[]> {
  const sets = await listStatsSetRows();
  const exercises = await selectRows<Exercise>('exercise');
  const exerciseMap = new Map(exercises.map((e) => [e.id, e.name]));

  const byExercise = new Map<string, string[]>();
  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) byExercise.set(set.exerciseId, []);
    const dates = byExercise.get(set.exerciseId)!;
    if (!dates.includes(set.date)) dates.push(set.date);
  }

  return sets.map((set) => {
    const sessionDates = byExercise.get(set.exerciseId) || [];
    const sessionIndex = sessionDates.indexOf(set.date) + 1;
    return {
      ...set,
      sessionIndex,
      exerciseName: exerciseMap.get(set.exerciseId) || 'Unknown',
    };
  });
}
