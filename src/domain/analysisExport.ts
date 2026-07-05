/**
 * Analysis export: shapes one week or month of local data (plan, training,
 * nutrition, body, health) into a compact JSON object the user pastes into an
 * external AI for analysis. Pure — callers fetch the rows (see export screen).
 */
import { scaleNutrients, sumNutrients, type Nutrients, type NutrientTargets } from './nutrition';
import type { HealthDay } from './healthStats';

export type ExportRangeMode = 'week' | 'month';

export interface ExportRange {
  mode: ExportRangeMode;
  /** YYYY-MM-DD, inclusive */
  start: string;
  /** YYYY-MM-DD, inclusive */
  end: string;
  /** human label, e.g. "KW 27/2026" or "Juli 2026" */
  label: string;
}

export interface ExportBlock {
  date: string;
  type: string;
  title: string;
  start: string;
  end: string;
  status: string;
}

export interface ExportSessionExercise {
  name: string;
  sets: { reps: number | null; weightKg: number | null }[];
}

export interface ExportSession {
  date: string;
  title: string;
  durationMinutes: number | null;
  exercises: ExportSessionExercise[];
}

export interface ExportFoodEntry {
  date: string;
  name: string;
  meal: string;
  amountG: number;
  /** per 100 g */
  nutrients: Nutrients;
}

export interface ExportMeasurement {
  date: string;
  weightKg: number;
  fatPercent: number | null;
}

export interface ExportTask {
  title: string;
  category: string;
  status: string;
  completedAt: string | null;
}

export interface AnalysisExportInput {
  range: ExportRange;
  profile: {
    age: number | null;
    sex: string | null;
    heightCm: number | null;
    weightKg: number | null;
    goal: string | null;
  } | null;
  targets: NutrientTargets;
  blocks: ExportBlock[];
  tasks: ExportTask[];
  sessions: ExportSession[];
  foodEntries: ExportFoodEntry[];
  measurements: ExportMeasurement[];
  healthDays: HealthDay[];
}

export interface NutritionDaySummary {
  date: string;
  entries: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  sugarsG: number;
  fiberG: number;
  saltG: number;
}

function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/** Aggregates logged food entries into one summary row per day, oldest first. */
export function nutritionDaySummaries(entries: ExportFoodEntry[]): NutritionDaySummary[] {
  const byDate = new Map<string, ExportFoodEntry[]>();
  for (const entry of entries) {
    const list = byDate.get(entry.date) ?? [];
    list.push(entry);
    byDate.set(entry.date, list);
  }
  return [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, dayEntries]) => {
      const total = sumNutrients(
        dayEntries.map((entry) => scaleNutrients(entry.nutrients, entry.amountG))
      );
      return {
        date,
        entries: dayEntries.length,
        kcal: Math.round(total.kcal ?? 0),
        proteinG: round1(total.protein ?? 0),
        carbsG: round1(total.carbs ?? 0),
        fatG: round1(total.fat ?? 0),
        sugarsG: round1(total.sugars ?? 0),
        fiberG: round1(total.fiber ?? 0),
        saltG: round1(total.salt ?? 0),
      };
    });
}

/** Σ reps × kg over all sets with both values. */
export function sessionVolumeKg(session: ExportSession): number {
  let volume = 0;
  for (const exercise of session.exercises) {
    for (const set of exercise.sets) {
      if (set.reps !== null && set.weightKg !== null) volume += set.reps * set.weightKg;
    }
  }
  return Math.round(volume);
}

function hasHealthData(day: HealthDay): boolean {
  return (
    day.sleepMinutes !== null || day.steps !== null || day.restingHr !== null || day.hrvMs !== null
  );
}

/**
 * Builds the export object. Sections without data are omitted so the AI
 * doesn't reason over empty arrays (health e.g. exists only on iOS).
 */
export function buildAnalysisExport(input: AnalysisExportInput): Record<string, unknown> {
  const blocks = input.blocks;
  const adherence = {
    done: blocks.filter((b) => b.status === 'done').length,
    skipped: blocks.filter((b) => b.status === 'skipped').length,
    open: blocks.filter((b) => b.status !== 'done' && b.status !== 'skipped').length,
  };

  const sessions = input.sessions.map((session) => ({
    date: session.date,
    title: session.title,
    durationMinutes: session.durationMinutes,
    volumeKg: sessionVolumeKg(session),
    exercises: session.exercises.map((exercise) => ({
      name: exercise.name,
      // compact set notation: [reps, weightKg] tuples keep the payload small
      sets: exercise.sets.map((set) => [set.reps, set.weightKg]),
    })),
  }));

  const nutritionDays = nutritionDaySummaries(input.foodEntries);
  const healthDays = input.healthDays.filter(hasHealthData);

  const result: Record<string, unknown> = {
    app: 'weeko',
    type: 'analysis-export',
    schemaVersion: 1,
    range: input.range,
    profile: input.profile ?? undefined,
    nutritionTargetsPerDay: input.targets,
  };
  if (blocks.length > 0) {
    result.plan = { adherence, blocks };
  }
  if (input.tasks.length > 0) {
    result.tasks = input.tasks;
  }
  if (sessions.length > 0) {
    result.training = { sessions };
  }
  if (nutritionDays.length > 0) {
    result.nutrition = { days: nutritionDays };
  }
  if (input.measurements.length > 0) {
    result.body = input.measurements;
  }
  if (healthDays.length > 0) {
    result.health = healthDays;
  }
  return result;
}
