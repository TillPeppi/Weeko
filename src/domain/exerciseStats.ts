/**
 * Per-exercise progression & personal records from logged sets.
 * Framework-free. Only checked-off (`done`) sets count; weightKg is the
 * added weight for weighted calisthenics, so bodyweight-only sets carry
 * weight null/0 and contribute reps but no volume/1RM.
 */

export interface ExerciseSetRow {
  sessionId: number;
  /** YYYY-MM-DD of the session */
  date: string;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
}

export interface SessionPoint {
  sessionId: number;
  date: string;
  /** heaviest set of the session (kg), null when all sets were unweighted */
  maxWeightKg: number | null;
  /** best estimated 1RM of the session (Epley), null without weighted sets */
  best1RmKg: number | null;
  /** Σ reps × kg of the session's done sets */
  volumeKg: number;
  /** most reps in a single set (any weight) */
  maxReps: number | null;
  sets: number;
}

export interface PrValue {
  value: number;
  date: string;
}

export interface ExercisePrs {
  maxWeight: PrValue | null;
  best1Rm: PrValue | null;
  maxSessionVolume: PrValue | null;
  maxReps: PrValue | null;
}

/** Epley formula: 1RM ≈ weight × (1 + reps/30). */
export function epley1Rm(reps: number, weightKg: number): number {
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** One point per session (done sets only), sorted oldest → newest. */
export function exerciseProgression(rows: ExerciseSetRow[]): SessionPoint[] {
  const bySession = new Map<number, { date: string; rows: ExerciseSetRow[] }>();
  for (const row of rows) {
    if (!row.done || !row.reps || row.reps <= 0) continue;
    const entry = bySession.get(row.sessionId) ?? { date: row.date, rows: [] };
    entry.rows.push(row);
    bySession.set(row.sessionId, entry);
  }
  const points: SessionPoint[] = [];
  for (const [sessionId, { date, rows: sets }] of bySession) {
    let maxWeightKg: number | null = null;
    let best1RmKg: number | null = null;
    let maxReps: number | null = null;
    let volumeKg = 0;
    for (const set of sets) {
      const reps = set.reps ?? 0;
      const weight = set.weightKg ?? 0;
      if (weight > 0) {
        volumeKg += reps * weight;
        if (maxWeightKg === null || weight > maxWeightKg) maxWeightKg = weight;
        const e1rm = epley1Rm(reps, weight);
        if (best1RmKg === null || e1rm > best1RmKg) best1RmKg = e1rm;
      }
      if (maxReps === null || reps > maxReps) maxReps = reps;
    }
    points.push({
      sessionId,
      date,
      maxWeightKg,
      best1RmKg,
      volumeKg: Math.round(volumeKg * 10) / 10,
      maxReps,
      sets: sets.length,
    });
  }
  return points.sort((a, b) => (a.date === b.date ? a.sessionId - b.sessionId : a.date.localeCompare(b.date)));
}

function best(
  points: SessionPoint[],
  pick: (p: SessionPoint) => number | null
): PrValue | null {
  let result: PrValue | null = null;
  for (const point of points) {
    const value = pick(point);
    if (value === null || value <= 0) continue;
    if (result === null || value > result.value) result = { value, date: point.date };
  }
  return result;
}

/** All-time records across the progression points. */
export function exercisePrs(points: SessionPoint[]): ExercisePrs {
  return {
    maxWeight: best(points, (p) => p.maxWeightKg),
    best1Rm: best(points, (p) => p.best1RmKg),
    maxSessionVolume: best(points, (p) => p.volumeKg),
    maxReps: best(points, (p) => p.maxReps),
  };
}

/**
 * Session ids that set a new all-time record (max weight or estimated 1RM)
 * at the time they happened — the "new PR" glow in the chart.
 */
export function prSessionIds(points: SessionPoint[]): Set<number> {
  const ids = new Set<number>();
  let bestWeight = 0;
  let best1Rm = 0;
  for (const point of points) {
    let isPr = false;
    if (point.maxWeightKg !== null && point.maxWeightKg > bestWeight) {
      bestWeight = point.maxWeightKg;
      isPr = true;
    }
    if (point.best1RmKg !== null && point.best1RmKg > best1Rm) {
      best1Rm = point.best1RmKg;
      isPr = true;
    }
    if (isPr) ids.add(point.sessionId);
  }
  return ids;
}
