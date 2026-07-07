/**
 * Full-data export (JSON dump) and complete wipe — Settings §6.6.
 * Also collects the raw rows for the range-based analysis export (shaped in
 * domain/analysisExport.ts). Data never leaves the device unless the user
 * explicitly exports.
 */
import { and, asc, eq, gte, inArray, lt, lte, ne, or } from 'drizzle-orm';
import { db } from '../client';
import {
  block,
  bodyMeasurement,
  coachDismissal,
  equipment,
  exercise,
  foodEntry,
  foodProduct,
  notificationPref,
  profile,
  sessionTemplate,
  setLog,
  task,
  week,
  weekTemplate,
  weeklyStructure,
  workoutSession,
} from '../schema';
import { addDaysIso } from '@/domain/time';
import type {
  ExportBlock,
  ExportFoodEntry,
  ExportMeasurement,
  ExportSession,
  ExportTask,
} from '@/domain/analysisExport';
import type { Profile } from '../schema';

export async function exportAllData(): Promise<string> {
  const dump = {
    exportedAt: new Date().toISOString(),
    app: 'weeko',
    version: 1,
    data: {
      profile: await db.select().from(profile),
      weeklyStructure: await db.select().from(weeklyStructure),
      equipment: await db.select().from(equipment),
      exercise: await db.select().from(exercise),
      week: await db.select().from(week),
      block: await db.select().from(block),
      task: await db.select().from(task),
      workoutSession: await db.select().from(workoutSession),
      setLog: await db.select().from(setLog),
      sessionTemplate: await db.select().from(sessionTemplate),
      weekTemplate: await db.select().from(weekTemplate),
      notificationPref: await db.select().from(notificationPref),
      foodProduct: await db.select().from(foodProduct),
      foodEntry: await db.select().from(foodEntry),
      coachDismissal: await db.select().from(coachDismissal),
    },
  };
  return JSON.stringify(dump, null, 2);
}

export interface AnalysisRangeData {
  profile: Profile | null;
  blocks: ExportBlock[];
  tasks: ExportTask[];
  sessions: ExportSession[];
  foodEntries: ExportFoodEntry[];
  measurements: ExportMeasurement[];
}

/**
 * Raw rows for the analysis export of [start, end] (inclusive ISO dates):
 * plan blocks, tasks touching the range, finished/aborted workout sessions
 * with their sets, food entries and body measurements.
 */
export async function collectAnalysisRange(start: string, end: string): Promise<AnalysisRangeData> {
  const nextDay = addDaysIso(end, 1);

  const profileRows = await db.select().from(profile);

  const blockRows = await db
    .select()
    .from(block)
    .where(and(gte(block.date, start), lte(block.date, end)))
    .orderBy(asc(block.date), asc(block.start));

  // tasks completed in range, plus everything still open (context for the AI)
  const taskRows = await db
    .select()
    .from(task)
    .where(
      or(
        eq(task.status, 'open'),
        and(gte(task.completedAt, start), lt(task.completedAt, nextDay))
      )
    );

  const sessionRows = await db
    .select()
    .from(workoutSession)
    .where(
      and(
        ne(workoutSession.status, 'active'),
        gte(workoutSession.startedAt, start),
        lt(workoutSession.startedAt, nextDay)
      )
    )
    .orderBy(asc(workoutSession.startedAt));

  const sessionIds = sessionRows.map((s) => s.id);
  const setRows = sessionIds.length
    ? await db
        .select()
        .from(setLog)
        // insertion order ≈ performed order (keeps exercise sequence intact)
        .where(inArray(setLog.sessionId, sessionIds))
        .orderBy(asc(setLog.sessionId), asc(setLog.id))
    : [];
  const exerciseRows = await db.select().from(exercise);
  const exerciseName = new Map(exerciseRows.map((e) => [e.id, e.name]));

  const sessions: ExportSession[] = sessionRows.map((session) => {
    const ownSets = setRows.filter((s) => s.sessionId === session.id && s.done);
    // group sets by exercise, keeping first-seen order
    const byExercise = new Map<string, typeof ownSets>();
    for (const set of ownSets) {
      const list = byExercise.get(set.exerciseId) ?? [];
      list.push(set);
      byExercise.set(set.exerciseId, list);
    }
    const durationMinutes = session.endedAt
      ? Math.max(0, Math.round((Date.parse(session.endedAt) - Date.parse(session.startedAt)) / 60000))
      : null;
    return {
      date: session.startedAt.slice(0, 10),
      title: session.title,
      durationMinutes,
      exercises: [...byExercise.entries()].map(([exerciseId, sets]) => ({
        name: exerciseName.get(exerciseId) ?? `#${exerciseId}`,
        sets: sets.map((set) => ({ reps: set.reps, weightKg: set.weightKg })),
      })),
    };
  });

  const foodRows = await db
    .select()
    .from(foodEntry)
    .where(and(gte(foodEntry.date, start), lte(foodEntry.date, end)))
    .orderBy(asc(foodEntry.date), asc(foodEntry.createdAt));

  const measurementRows = await db
    .select()
    .from(bodyMeasurement)
    .where(and(gte(bodyMeasurement.date, start), lte(bodyMeasurement.date, end)))
    .orderBy(asc(bodyMeasurement.date));

  return {
    profile: profileRows[0] ?? null,
    blocks: blockRows.map((b) => ({
      date: b.date,
      type: b.type,
      title: b.title,
      start: b.start,
      end: b.end,
      status: b.status,
    })),
    tasks: taskRows.map((t) => ({
      title: t.title,
      category: t.category,
      status: t.status,
      completedAt: t.completedAt,
    })),
    sessions,
    foodEntries: foodRows.map((f) => ({
      date: f.date,
      name: f.name,
      meal: f.meal,
      amountG: f.amountG,
      nutrients: f.nutrients,
    })),
    measurements: measurementRows.map((m) => ({
      date: m.date,
      weightKg: m.weightKg,
      fatPercent: m.fatPercent,
      muscleMassKg: m.muscleMassKg,
      boneMassKg: m.boneMassKg,
      bmrKcal: m.bmrKcal,
    })),
  };
}

/** Deletes ALL user data (irreversible). Caller must confirm with the user. */
export async function deleteAllData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(coachDismissal);
    await tx.delete(foodEntry);
    await tx.delete(foodProduct);
    await tx.delete(setLog);
    await tx.delete(workoutSession);
    await tx.delete(task);
    await tx.delete(block);
    await tx.delete(week);
    await tx.delete(weekTemplate);
    await tx.delete(sessionTemplate);
    await tx.delete(exercise);
    await tx.delete(equipment);
    await tx.delete(weeklyStructure);
    await tx.delete(notificationPref);
    await tx.delete(profile);
  });
}
