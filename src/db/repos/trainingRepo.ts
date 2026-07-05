import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import {
  equipment,
  exercise,
  sessionTemplate,
  setLog,
  workoutSession,
  type SessionTemplate,
  type SetLog,
  type WorkoutSession,
} from '../schema';
import type { SessionTemplateSeed } from '../seeds';
import type { TrainingImportParsed } from '@/schemas/trainingImport';
import { importExerciseLabel } from '@/domain/parseTrainingImport';

export async function listSessionTemplates(): Promise<SessionTemplate[]> {
  return db.select().from(sessionTemplate).orderBy(asc(sessionTemplate.id));
}

export async function seedSessionTemplates(seeds: SessionTemplateSeed[]): Promise<void> {
  const existing = await listSessionTemplates();
  if (existing.length > 0) return;
  for (const seed of seeds) {
    await db.insert(sessionTemplate).values({ ...seed, id: newId(), ...auditInsert() });
  }
}

export async function getActiveSession(): Promise<WorkoutSession | undefined> {
  const rows = await db
    .select()
    .from(workoutSession)
    .where(eq(workoutSession.status, 'active'))
    .orderBy(desc(workoutSession.startedAt));
  return rows[0];
}

export async function startSession(values: {
  title: string;
  blockId?: string | null;
  templateId?: string | null;
}): Promise<string> {
  // only one active session at a time — abort stale ones
  await db
    .update(workoutSession)
    .set({ status: 'aborted', endedAt: nowIso() })
    .where(eq(workoutSession.status, 'active'));
  const id = newId();
  await db.insert(workoutSession).values({
    id,
    title: values.title,
    blockId: values.blockId ?? null,
    templateId: values.templateId ?? null,
    startedAt: nowIso(),
    status: 'active',
    ...auditInsert(),
  });
  return id;
}

export async function finishSession(id: string, aborted = false): Promise<void> {
  await db
    .update(workoutSession)
    .set({ status: aborted ? 'aborted' : 'done', endedAt: nowIso() })
    .where(eq(workoutSession.id, id));
}

export async function getSession(id: string): Promise<WorkoutSession | undefined> {
  const rows = await db.select().from(workoutSession).where(eq(workoutSession.id, id));
  return rows[0];
}

export async function listSessions(limit = 30): Promise<WorkoutSession[]> {
  return db
    .select()
    .from(workoutSession)
    .where(ne(workoutSession.status, 'active'))
    .orderBy(desc(workoutSession.startedAt))
    .limit(limit);
}

/** All finished sessions, oldest first — statistics. */
export async function listDoneSessions(): Promise<WorkoutSession[]> {
  return db
    .select()
    .from(workoutSession)
    .where(eq(workoutSession.status, 'done'))
    .orderBy(asc(workoutSession.startedAt));
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
  const rows = await db
    .select({
      sessionId: setLog.sessionId,
      exerciseId: setLog.exerciseId,
      startedAt: workoutSession.startedAt,
      reps: setLog.reps,
      weightKg: setLog.weightKg,
      done: setLog.done,
    })
    .from(setLog)
    .innerJoin(workoutSession, eq(setLog.sessionId, workoutSession.id))
    .where(eq(workoutSession.status, 'done'));
  return rows.map(({ startedAt, ...rest }) => ({ ...rest, date: startedAt.slice(0, 10) }));
}

/** Distinct YYYY-MM-DD days with a finished session — training dashboard. */
export async function trainingDayDates(): Promise<string[]> {
  const rows = await db
    .select({ startedAt: workoutSession.startedAt })
    .from(workoutSession)
    .where(eq(workoutSession.status, 'done'));
  return [...new Set(rows.map((row) => row.startedAt.slice(0, 10)))];
}

/** Set progress of a session: how many logged sets are checked off. */
export async function sessionSetProgress(
  sessionId: string
): Promise<{ done: number; total: number }> {
  const rows = await db.select().from(setLog).where(eq(setLog.sessionId, sessionId));
  return { total: rows.length, done: rows.filter((r) => r.done).length };
}

export async function listSetLogs(sessionId: string): Promise<SetLog[]> {
  return db
    .select()
    .from(setLog)
    .where(eq(setLog.sessionId, sessionId))
    .orderBy(asc(setLog.exerciseId), asc(setLog.setIndex));
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
    await db
      .update(setLog)
      .set({
        reps: values.reps,
        weightKg: values.weightKg,
        done: values.done,
        supersetGroup: values.supersetGroup ?? null,
      })
      .where(eq(setLog.id, values.id));
    return values.id;
  }
  const id = newId();
  await db
    .insert(setLog)
    .values({ ...values, id, supersetGroup: values.supersetGroup ?? null, createdAt: nowIso(), ...auditInsert() });
  return id;
}

export async function deleteSetLog(id: string): Promise<void> {
  await db.delete(setLog).where(eq(setLog.id, id));
}

/** Assigns (or clears) the superset group for every logged set of an exercise in a session. */
export async function setExerciseSupersetGroup(
  sessionId: string,
  exerciseId: string,
  group: number | null
): Promise<void> {
  await db
    .update(setLog)
    .set({ supersetGroup: group })
    .where(and(eq(setLog.sessionId, sessionId), eq(setLog.exerciseId, exerciseId)));
}

/**
 * Prefill data: the sets of the most recent finished session containing this
 * exercise ("letztes Mal 3×8 @ +10 kg").
 */
export async function lastSetsForExercise(
  exerciseId: string,
  excludeSessionId?: string
): Promise<SetLog[]> {
  const sessions = await db
    .select({ id: workoutSession.id, startedAt: workoutSession.startedAt })
    .from(workoutSession)
    .innerJoin(setLog, eq(setLog.sessionId, workoutSession.id))
    .where(and(eq(setLog.exerciseId, exerciseId), eq(workoutSession.status, 'done')))
    .orderBy(desc(workoutSession.startedAt));
  const lastSession = sessions.find((s) => s.id !== excludeSessionId);
  if (!lastSession) return [];
  return db
    .select()
    .from(setLog)
    .where(and(eq(setLog.sessionId, lastSession.id), eq(setLog.exerciseId, exerciseId)))
    .orderBy(asc(setLog.setIndex));
}

/** Resolves template items to exercise ids by name (case-insensitive). */
export async function resolveTemplateExercises(
  template: SessionTemplate
): Promise<{ exerciseId: string; targetSets: number; targetReps: number }[]> {
  const exercises = await db.select().from(exercise);
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

/**
 * Match key for an import exercise: name alone when no equipment is given,
 * otherwise name + equipment (so "Beinbeuger (Kabel)" and "Beinbeuger
 * (Maschine)" stay distinct). Names carry no equipment; equipment lives in its
 * own field and its own table (exercise.equipmentId → equipment.name).
 */
const NAME_EQUIP_SEP = ' ';
function matchKey(name: string, equipment?: string): string {
  const nameLower = name.trim().toLowerCase();
  const equipLower = equipment?.trim().toLowerCase();
  return equipLower ? `${nameLower}${NAME_EQUIP_SEP}${equipLower}` : nameLower;
}

/**
 * Existing (name, name+equipment) keys, so an import item can be matched either
 * by name alone (no equipment given → any variant counts as known) or by the
 * exact name+equipment pair.
 */
async function existingExerciseKeys(): Promise<{ names: Set<string>; nameEquips: Set<string> }> {
  const [exercises, equipments] = await Promise.all([
    db.select().from(exercise),
    db.select().from(equipment),
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
 * `startedAt` is stored as local-naive ISO (`YYYY-MM-DDTHH:mm:00`) so the
 * date-based statistics (`startedAt.slice(0, 10)`) hit the intended day.
 */
export async function importTrainingSessions(
  data: TrainingImportParsed
): Promise<TrainingImportResult> {
  const result: TrainingImportResult = { sessions: 0, sets: 0, createdExercises: [] };

  await db.transaction(async (tx) => {
    const [existing, existingEquipment] = await Promise.all([
      tx.select().from(exercise),
      tx.select().from(equipment),
    ]);

    const equipIdByName = new Map(existingEquipment.map((e) => [e.name.toLowerCase(), e.id]));
    const equipNameById = new Map(existingEquipment.map((e) => [e.id, e.name.toLowerCase()]));

    // name-only and name+equipment lookups (mirrors existingExerciseKeys)
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
      await tx.insert(equipment).values({ id, name: equipName, available: true, ...auditInsert() });
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
      await tx.insert(exercise).values({ id, name, equipmentId, isWeighted: weighted, ...auditInsert() });
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
      await tx.insert(workoutSession).values({
        id: sessionId,
        title: session.title,
        startedAt,
        endedAt,
        status: 'done',
        ...auditInsert(),
      });
      result.sessions += 1;

      for (const item of session.exercises) {
        const name = item.name.trim();
        const equipName = item.equipment?.trim() || undefined;
        const weighted = item.sets.some((set) => (set.weightKg ?? 0) > 0);
        const exerciseId = await ensureExercise(name, equipName, weighted);

        // Cardio/mobility without countable sets: record a single placeholder set
        // (null reps/weight) so the exercise still shows up in the session. Stats
        // skip null-reps sets, so it never distorts volume/1RM.
        if (item.sets.length === 0) {
          await tx.insert(setLog).values({
            id: newId(),
            sessionId,
            exerciseId,
            setIndex: 1,
            reps: null,
            weightKg: null,
            done: true,
            supersetGroup: null,
            createdAt: nowIso(),
            ...auditInsert(),
          });
          continue;
        }

        for (const [index, set] of item.sets.entries()) {
          await tx.insert(setLog).values({
            id: newId(),
            sessionId,
            exerciseId,
            setIndex: index + 1,
            reps: set.reps ?? null,
            weightKg: set.weightKg ?? null,
            done: true,
            supersetGroup: null,
            createdAt: nowIso(),
            ...auditInsert(),
          });
          result.sets += 1;
        }
      }
    }
  });

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
  const exercises = await db.select().from(exercise);
  const exerciseMap = new Map(exercises.map((e) => [e.id, e.name]));

  // Group by exercise and date
  const byExercise = new Map<string, string[]>();
  for (const set of sets) {
    if (!byExercise.has(set.exerciseId)) {
      byExercise.set(set.exerciseId, []);
    }
    const dates = byExercise.get(set.exerciseId)!;
    if (!dates.includes(set.date)) {
      dates.push(set.date);
    }
  }

  // For each set, find its session index
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
