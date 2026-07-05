import { describe, expect, it } from 'vitest';
import {
  epley1Rm,
  exercisePrs,
  exerciseProgression,
  prSessionIds,
  type ExerciseSetRow,
} from './exerciseStats';

const row = (
  sessionId: number,
  date: string,
  reps: number | null,
  weightKg: number | null,
  done = true
): ExerciseSetRow => ({ sessionId, date, reps, weightKg, done });

describe('epley1Rm', () => {
  it('estimates 1RM via Epley', () => {
    expect(epley1Rm(1, 100)).toBe(103.3);
    expect(epley1Rm(8, 10)).toBe(12.7);
  });
});

describe('exerciseProgression', () => {
  it('aggregates done sets per session, sorted by date', () => {
    const points = exerciseProgression([
      row(2, '2026-07-03', 8, 10),
      row(2, '2026-07-03', 6, 12.5),
      row(1, '2026-06-26', 8, 10),
      row(1, '2026-06-26', 8, null), // bodyweight set: reps count, no volume
      row(1, '2026-06-26', 5, 15, false), // not checked off — ignored
    ]);
    expect(points.map((p) => p.sessionId)).toEqual([1, 2]);
    expect(points[0]).toMatchObject({
      maxWeightKg: 10,
      volumeKg: 80,
      maxReps: 8,
      sets: 2,
    });
    expect(points[1]).toMatchObject({ maxWeightKg: 12.5, volumeKg: 155 });
    expect(points[1].best1RmKg).toBe(epley1Rm(6, 12.5));
  });

  it('handles bodyweight-only sessions (no weight → null records, reps kept)', () => {
    const points = exerciseProgression([row(1, '2026-07-01', 12, null)]);
    expect(points[0].maxWeightKg).toBeNull();
    expect(points[0].best1RmKg).toBeNull();
    expect(points[0].volumeKg).toBe(0);
    expect(points[0].maxReps).toBe(12);
  });

  it('ignores sets without reps', () => {
    expect(exerciseProgression([row(1, '2026-07-01', null, 10)])).toEqual([]);
  });
});

describe('exercisePrs / prSessionIds', () => {
  const points = exerciseProgression([
    row(1, '2026-06-01', 8, 10),
    row(2, '2026-06-08', 8, 12.5), // weight PR
    row(3, '2026-06-15', 6, 10), // no PR
    row(4, '2026-06-22', 12, 12.5), // e1RM PR (same weight, more reps)
  ]);

  it('finds all-time records with their dates', () => {
    const prs = exercisePrs(points);
    expect(prs.maxWeight).toEqual({ value: 12.5, date: '2026-06-08' });
    expect(prs.best1Rm).toEqual({ value: epley1Rm(12, 12.5), date: '2026-06-22' });
    expect(prs.maxSessionVolume).toEqual({ value: 150, date: '2026-06-22' });
    expect(prs.maxReps).toEqual({ value: 12, date: '2026-06-22' });
  });

  it('marks sessions that set a new record at the time', () => {
    expect(prSessionIds(points)).toEqual(new Set([1, 2, 4]));
  });

  it('handles empty input', () => {
    const prs = exercisePrs([]);
    expect(prs.maxWeight).toBeNull();
    expect(prs.best1Rm).toBeNull();
  });
});
