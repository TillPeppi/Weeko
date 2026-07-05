/**
 * Pure training signals for the coach engine: strength-progression stall and
 * consecutive-training-day strain. Framework-free; reuses exerciseStats.
 */
import { exerciseProgression, type ExerciseSetRow } from '../exerciseStats';
import { addDaysIso } from '../time';
import type { TrainingSetLike } from './context';

/** Min weighted sessions of an exercise before a stall verdict is meaningful. */
export const STALL_MIN_SESSIONS = 4;
/** Sessions since the last PR that count as "stalled". */
export const STALL_SINCE_PR = 3;

export interface StalledExercise {
  exerciseId: number;
  /** weighted sessions logged since the last estimated-1RM PR */
  sessionsSincePr: number;
  /** heaviest weight in the most recent session (kg) */
  lastWeightKg: number;
}

/**
 * The most-stalled weighted exercise: one whose best estimated 1RM last peaked
 * `STALL_SINCE_PR`+ sessions ago (with at least `STALL_MIN_SESSIONS` weighted
 * sessions). Returns the exercise stalled longest, or null if none qualify.
 */
export function stalledExercise(sets: TrainingSetLike[]): StalledExercise | null {
  const byExercise = new Map<number, ExerciseSetRow[]>();
  for (const set of sets) {
    const list = byExercise.get(set.exerciseId) ?? [];
    list.push({ sessionId: set.sessionId, date: set.date, reps: set.reps, weightKg: set.weightKg, done: set.done });
    byExercise.set(set.exerciseId, list);
  }

  let best: StalledExercise | null = null;
  for (const [exerciseId, rows] of byExercise) {
    const points = exerciseProgression(rows).filter((p) => p.best1RmKg !== null);
    if (points.length < STALL_MIN_SESSIONS) continue;

    let prIndex = 0;
    let prValue = -1;
    points.forEach((p, i) => {
      if ((p.best1RmKg as number) > prValue) {
        prValue = p.best1RmKg as number;
        prIndex = i;
      }
    });
    const sessionsSincePr = points.length - 1 - prIndex;
    if (sessionsSincePr < STALL_SINCE_PR) continue;

    if (!best || sessionsSincePr > best.sessionsSincePr) {
      best = {
        exerciseId,
        sessionsSincePr,
        lastWeightKg: points[points.length - 1].maxWeightKg ?? 0,
      };
    }
  }
  return best;
}

/**
 * Consecutive training days ending at the most recent trained day, but only if
 * that day is today or yesterday (otherwise the streak isn't "current"). Used
 * to flag insufficient rest. `dates` = distinct YYYY-MM-DD training days.
 */
export function currentTrainingStreak(dates: string[], today: string): number {
  const trained = new Set(dates);
  let anchor: string | null = null;
  if (trained.has(today)) anchor = today;
  else if (trained.has(addDaysIso(today, -1))) anchor = addDaysIso(today, -1);
  if (!anchor) return 0;

  let streak = 0;
  let cursor = anchor;
  while (trained.has(cursor)) {
    streak += 1;
    cursor = addDaysIso(cursor, -1);
  }
  return streak;
}
