import { and, asc, desc, eq, ne } from 'drizzle-orm';
import { db, nowIso } from '../client';
import {
  exercise,
  sessionTemplate,
  setLog,
  workoutSession,
  type SessionTemplate,
  type SetLog,
  type WorkoutSession,
} from '../schema';
import type { SessionTemplateSeed } from '../seeds';

export async function listSessionTemplates(): Promise<SessionTemplate[]> {
  return db.select().from(sessionTemplate).orderBy(asc(sessionTemplate.id));
}

export async function seedSessionTemplates(seeds: SessionTemplateSeed[]): Promise<void> {
  const existing = await listSessionTemplates();
  if (existing.length > 0) return;
  for (const seed of seeds) {
    await db.insert(sessionTemplate).values(seed);
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
  blockId?: number | null;
  templateId?: number | null;
}): Promise<number> {
  // only one active session at a time — abort stale ones
  await db
    .update(workoutSession)
    .set({ status: 'aborted', endedAt: nowIso() })
    .where(eq(workoutSession.status, 'active'));
  const inserted = await db
    .insert(workoutSession)
    .values({
      title: values.title,
      blockId: values.blockId ?? null,
      templateId: values.templateId ?? null,
      startedAt: nowIso(),
      status: 'active',
    })
    .returning({ id: workoutSession.id });
  return inserted[0].id;
}

export async function finishSession(id: number, aborted = false): Promise<void> {
  await db
    .update(workoutSession)
    .set({ status: aborted ? 'aborted' : 'done', endedAt: nowIso() })
    .where(eq(workoutSession.id, id));
}

export async function getSession(id: number): Promise<WorkoutSession | undefined> {
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
  sessionId: number;
  exerciseId: number;
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
  sessionId: number
): Promise<{ done: number; total: number }> {
  const rows = await db.select().from(setLog).where(eq(setLog.sessionId, sessionId));
  return { total: rows.length, done: rows.filter((r) => r.done).length };
}

export async function listSetLogs(sessionId: number): Promise<SetLog[]> {
  return db
    .select()
    .from(setLog)
    .where(eq(setLog.sessionId, sessionId))
    .orderBy(asc(setLog.exerciseId), asc(setLog.setIndex));
}

export async function upsertSetLog(values: {
  id?: number;
  sessionId: number;
  exerciseId: number;
  setIndex: number;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
  supersetGroup?: number | null;
}): Promise<number> {
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
  const inserted = await db
    .insert(setLog)
    .values({ ...values, supersetGroup: values.supersetGroup ?? null, createdAt: nowIso() })
    .returning({ id: setLog.id });
  return inserted[0].id;
}

export async function deleteSetLog(id: number): Promise<void> {
  await db.delete(setLog).where(eq(setLog.id, id));
}

/** Assigns (or clears) the superset group for every logged set of an exercise in a session. */
export async function setExerciseSupersetGroup(
  sessionId: number,
  exerciseId: number,
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
  exerciseId: number,
  excludeSessionId?: number
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
): Promise<{ exerciseId: number; targetSets: number; targetReps: number }[]> {
  const exercises = await db.select().from(exercise);
  const byName = new Map(exercises.map((e) => [e.name.toLowerCase(), e.id]));
  const resolved: { exerciseId: number; targetSets: number; targetReps: number }[] = [];
  for (const item of template.items) {
    const id = byName.get(item.exerciseName.toLowerCase());
    if (id !== undefined) {
      resolved.push({ exerciseId: id, targetSets: item.targetSets, targetReps: item.targetReps });
    }
  }
  return resolved;
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
  const byExercise = new Map<number, string[]>();
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
