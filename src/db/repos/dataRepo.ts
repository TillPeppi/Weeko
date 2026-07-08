/**
 * Full-data export (JSON dump) and complete/selective wipe — Settings §6.6.
 * Also collects the raw rows for the range-based analysis export (shaped in
 * domain/analysisExport.ts). Synced data lives in Supabase (RLS-scoped to the
 * signed-in user); food_product + coach_dismissal are device-local.
 */
import { deleteAllRows, nowIso, sb, selectRows } from '../sb';
import type {
  Block,
  BodyMeasurement,
  Equipment,
  Exercise,
  FoodEntry,
  NotificationPref,
  Profile,
  SessionTemplate,
  SetLog,
  Task,
  Week,
  WeekTemplate,
  WeeklyStructureRow,
  WorkoutSession,
} from '../schema';
import { addDaysIso } from '@/domain/time';
import { allProducts, clearProducts } from './foodRepo';
import { clearDismissals, listDismissals } from './coachDismissalRepo';
import type {
  ExportBlock,
  ExportFoodEntry,
  ExportMeasurement,
  ExportSession,
  ExportTask,
} from '@/domain/analysisExport';

export async function exportAllData(): Promise<string> {
  const [
    profile,
    weeklyStructure,
    equipment,
    exercise,
    week,
    block,
    task,
    workoutSession,
    setLog,
    sessionTemplate,
    weekTemplate,
    notificationPref,
    foodEntry,
    bodyMeasurement,
    foodProduct,
    coachDismissal,
  ] = await Promise.all([
    selectRows<Profile>('profile'),
    selectRows<WeeklyStructureRow>('weekly_structure'),
    selectRows<Equipment>('equipment'),
    selectRows<Exercise>('exercise'),
    selectRows<Week>('week'),
    selectRows<Block>('block'),
    selectRows<Task>('task'),
    selectRows<WorkoutSession>('workout_session'),
    selectRows<SetLog>('set_log'),
    selectRows<SessionTemplate>('session_template'),
    selectRows<WeekTemplate>('week_template'),
    selectRows<NotificationPref>('notification_pref'),
    selectRows<FoodEntry>('food_entry'),
    selectRows<BodyMeasurement>('body_measurement'),
    allProducts(),
    listDismissals(),
  ]);
  const dump = {
    exportedAt: new Date().toISOString(),
    app: 'weeko',
    version: 1,
    data: {
      profile,
      weeklyStructure,
      equipment,
      exercise,
      week,
      block,
      task,
      workoutSession,
      setLog,
      sessionTemplate,
      weekTemplate,
      notificationPref,
      foodProduct,
      foodEntry,
      coachDismissal,
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

  const profileRows = await selectRows<Profile>('profile');

  const blockRows = await selectRows<Block>('block', (q) =>
    q.gte('date', start).lte('date', end).order('date', { ascending: true }).order('start', { ascending: true })
  );

  // tasks still open, plus tasks completed in range (context for the AI)
  const taskRows = await selectRows<Task>('task', (q) =>
    q.or(`status.eq.open,and(completed_at.gte.${start},completed_at.lt.${nextDay})`)
  );

  const sessionRows = await selectRows<WorkoutSession>('workout_session', (q) =>
    q
      .neq('status', 'active')
      .gte('started_at', start)
      .lt('started_at', nextDay)
      .order('started_at', { ascending: true })
  );

  const sessionIds = sessionRows.map((s) => s.id);
  const setRows = sessionIds.length
    ? await selectRows<SetLog>('set_log', (q) =>
        // insertion order ≈ performed order (keeps exercise sequence intact)
        q.in('session_id', sessionIds).order('session_id', { ascending: true }).order('id', { ascending: true })
      )
    : [];
  const exerciseRows = await selectRows<Exercise>('exercise');
  const exerciseName = new Map(exerciseRows.map((e) => [e.id, e.name]));

  const sessions: ExportSession[] = sessionRows.map((session) => {
    const ownSets = setRows.filter((s) => s.sessionId === session.id && s.done);
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

  const foodRows = await selectRows<FoodEntry>('food_entry', (q) =>
    q.gte('date', start).lte('date', end).order('date', { ascending: true }).order('created_at', { ascending: true })
  );

  const measurementRows = await selectRows<BodyMeasurement>('body_measurement', (q) =>
    q.gte('date', start).lte('date', end).order('date', { ascending: true })
  );

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

/** Row counts per deletable category — lets the UI show sizes and hide empty ones. */
export interface DataCounts {
  body: number;
  training: number;
  food: number;
  plan: number;
  tasks: number;
}

async function rowCount(table: string): Promise<number> {
  const { count, error } = await sb().from(table).select('*', { count: 'exact', head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function dataCounts(): Promise<DataCounts> {
  const [body, sessions, food, weeks, tasks] = await Promise.all([
    rowCount('body_measurement'),
    rowCount('workout_session'),
    rowCount('food_entry'),
    rowCount('week'),
    rowCount('task'),
  ]);
  return { body, training: sessions, food, plan: weeks, tasks };
}

/** Delete only body-composition measurements (weight/fat/muscle/…). */
export async function deleteBodyMeasurements(): Promise<void> {
  await deleteAllRows('body_measurement');
}

/** Delete logged training: sets first (FK), then sessions. Keeps the exercise catalog. */
export async function deleteTrainingLogs(): Promise<void> {
  await deleteAllRows('set_log');
  await deleteAllRows('workout_session');
}

/** Delete nutrition diary entries. Keeps the cached/custom product list. */
export async function deleteFoodEntries(): Promise<void> {
  await deleteAllRows('food_entry');
}

/** Delete the week plan: blocks first (belong to weeks), then weeks. Keeps templates. */
export async function deletePlanData(): Promise<void> {
  await deleteAllRows('block');
  await deleteAllRows('week');
}

/** Delete standalone tasks. */
export async function deleteTasks(): Promise<void> {
  await deleteAllRows('task');
}

/** Deletes ALL user data (irreversible). Caller must confirm with the user. */
export async function deleteAllData(): Promise<void> {
  // children before parents (FK order)
  await deleteAllRows('body_measurement');
  await deleteAllRows('food_entry');
  await deleteAllRows('set_log');
  await deleteAllRows('workout_session');
  await deleteAllRows('task');
  await deleteAllRows('block');
  await deleteAllRows('week');
  await deleteAllRows('week_template');
  await deleteAllRows('session_template');
  await deleteAllRows('exercise');
  await deleteAllRows('equipment');
  await deleteAllRows('weekly_structure');
  await deleteAllRows('notification_pref');
  await deleteAllRows('profile');
  await clearProducts();
  await clearDismissals();
}

// `nowIso` re-exported for callers that imported it from here historically.
export { nowIso };
