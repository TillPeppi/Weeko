import { describe, expect, it } from 'vitest';
import type { TrainingSetLike } from './context';
import {
  STALL_MIN_SESSIONS,
  currentTrainingStreak,
  stalledExercise,
} from './trainingSignals';

/** One done, weighted set (reps=1 → estimated 1RM equals the weight). */
const set = (
  exerciseId: number,
  sessionId: number,
  date: string,
  weightKg: number
): TrainingSetLike => ({
  exerciseId: String(exerciseId),
  sessionId: String(sessionId),
  date,
  reps: 1,
  weightKg,
  done: true,
});

/** Build weighted sessions for one exercise from a list of top weights. */
const sessions = (exerciseId: number, weights: number[]): TrainingSetLike[] =>
  weights.map((w, i) => set(exerciseId, i + 1, `2026-06-${String(i + 1).padStart(2, '0')}`, w));

describe('stalledExercise', () => {
  it('flags an exercise whose 1RM peaked STALL_SINCE_PR+ sessions ago', () => {
    // PR at session 2 (110), then 3 sessions without a new best
    const result = stalledExercise(sessions(1, [100, 110, 105, 105, 105]));
    expect(result).toEqual({ exerciseId: '1', sessionsSincePr: 3, lastWeightKg: 105 });
  });

  it('returns null while still progressing (PR is recent)', () => {
    expect(stalledExercise(sessions(1, [100, 105, 110, 115, 120]))).toBeNull();
  });

  it('returns null below the minimum weighted-session count', () => {
    expect(stalledExercise(sessions(1, Array(STALL_MIN_SESSIONS - 1).fill(100)))).toBeNull();
  });

  it('picks the most-stalled exercise across several', () => {
    const result = stalledExercise([
      ...sessions(1, [100, 110, 105, 105]), // stalled 2
      ...sessions(2, [50, 60, 55, 55, 55, 55]), // stalled 4
    ]);
    expect(result?.exerciseId).toBe('2');
    expect(result?.sessionsSincePr).toBe(4);
  });

  it('ignores bodyweight-only sets (no 1RM)', () => {
    const bodyweight = [1, 2, 3, 4].map((i) => ({
      exerciseId: '9',
      sessionId: String(i),
      date: `2026-06-0${i}`,
      reps: 10,
      weightKg: null as number | null,
      done: true,
    }));
    expect(stalledExercise(bodyweight)).toBeNull();
  });
});

describe('currentTrainingStreak', () => {
  const days = (...d: string[]) => d;

  it('counts consecutive days ending today', () => {
    expect(
      currentTrainingStreak(
        days('2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08'),
        '2026-07-08'
      )
    ).toBe(5);
  });

  it('anchors on yesterday when today is not trained yet', () => {
    expect(currentTrainingStreak(days('2026-07-06', '2026-07-07'), '2026-07-08')).toBe(2);
  });

  it('is 0 when the last training day is older than yesterday', () => {
    expect(currentTrainingStreak(days('2026-07-05'), '2026-07-08')).toBe(0);
  });

  it('is 0 with no training days', () => {
    expect(currentTrainingStreak([], '2026-07-08')).toBe(0);
  });
});
