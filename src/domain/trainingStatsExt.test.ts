import { describe, it, expect } from 'vitest';
import { monthlyTraining, exerciseWeightGains } from './trainingStats';

describe('trainingStats extended', () => {
  describe('monthlyTraining', () => {
    it('generates last N months', () => {
      const sessionDates = [
        '2024-01-05',
        '2024-01-10',
        '2024-02-08',
        '2024-03-01',
        '2024-03-15',
      ];
      const sets = [
        { date: '2024-01-05', reps: 10, weightKg: 20, done: true },
        { date: '2024-01-10', reps: 8, weightKg: 22, done: true },
        { date: '2024-02-08', reps: 12, weightKg: 25, done: true },
        { date: '2024-03-01', reps: 10, weightKg: 20, done: true },
        { date: '2024-03-15', reps: 15, weightKg: 20, done: true },
      ];
      const monthly = monthlyTraining(sessionDates, sets, '2024-03-15', 3);
      expect(monthly).toHaveLength(3);
      expect(monthly[1].monthLabel).toBe('2024-02');
      expect(monthly[1].sessions).toBe(1);
      expect(monthly[1].days).toBe(1);
      expect(monthly[2].monthLabel).toBe('2024-03');
      expect(monthly[2].sessions).toBe(2);
      expect(monthly[2].days).toBe(2);
    });
  });

  describe('exerciseWeightGains', () => {
    it('ignores first session, counts from 2nd onwards', () => {
      const sets = [
        // Exercise 1: 1st session
        { exerciseId: '1', exerciseName: 'Bench Press', sessionIndex: 1, reps: 8, weightKg: 80, done: true },
        // Exercise 1: 2nd session
        { exerciseId: '1', exerciseName: 'Bench Press', sessionIndex: 2, reps: 8, weightKg: 85, done: true },
        { exerciseId: '1', exerciseName: 'Bench Press', sessionIndex: 2, reps: 6, weightKg: 85, done: true },
        // Exercise 1: 3rd session
        { exerciseId: '1', exerciseName: 'Bench Press', sessionIndex: 3, reps: 10, weightKg: 87, done: true },
      ];
      const gains = exerciseWeightGains(sets);
      expect(gains).toHaveLength(1);
      const bench = gains[0];
      expect(bench.exerciseName).toBe('Bench Press');
      expect(bench.sessionCount).toBe(3);
      expect(bench.sessionCountForGain).toBe(2); // 2nd and 3rd
      expect(bench.maxWeightKg).toBe(87);
      expect(bench.avgWeightFirstSession).toBeCloseTo(85, 1); // avg of 2nd session
      expect(bench.avgWeightLatestSession).toBeCloseTo(87, 1); // 3rd session
      expect(bench.gainKg).toBeCloseTo(2, 1);
      expect(bench.gainPercent).toBeCloseTo(2.35, 1);
    });

    it('multiple exercises', () => {
      const sets = [
        // Squat: 1st (ignored), 2nd, 3rd
        { exerciseId: '1', exerciseName: 'Squat', sessionIndex: 1, reps: 5, weightKg: 100, done: true },
        { exerciseId: '1', exerciseName: 'Squat', sessionIndex: 2, reps: 5, weightKg: 105, done: true },
        { exerciseId: '1', exerciseName: 'Squat', sessionIndex: 3, reps: 5, weightKg: 110, done: true },
        // Deadlift: 1st (ignored), 2nd, 3rd
        { exerciseId: '2', exerciseName: 'Deadlift', sessionIndex: 1, reps: 3, weightKg: 140, done: true },
        { exerciseId: '2', exerciseName: 'Deadlift', sessionIndex: 2, reps: 3, weightKg: 145, done: true },
        { exerciseId: '2', exerciseName: 'Deadlift', sessionIndex: 3, reps: 3, weightKg: 150, done: true },
      ];
      const gains = exerciseWeightGains(sets);
      expect(gains).toHaveLength(2);
      expect(gains[0].gainKg).toBeCloseTo(5, 1);
      expect(gains[1].gainKg).toBeCloseTo(5, 1);
    });

    it('bodyweight exercises (null weight)', () => {
      const sets = [
        { exerciseId: '3', exerciseName: 'Pull-up', sessionIndex: 1, reps: 8, weightKg: null, done: true },
        { exerciseId: '3', exerciseName: 'Pull-up', sessionIndex: 2, reps: 10, weightKg: null, done: true },
      ];
      const gains = exerciseWeightGains(sets);
      expect(gains[0].maxWeightKg).toBe(0);
      expect(gains[0].gainKg).toBe(0);
    });

    it('only one session (no gain)', () => {
      const sets = [
        { exerciseId: '1', exerciseName: 'New Exercise', sessionIndex: 1, reps: 10, weightKg: 50, done: true },
      ];
      const gains = exerciseWeightGains(sets);
      expect(gains[0].sessionCount).toBe(1);
      expect(gains[0].sessionCountForGain).toBe(0);
      expect(gains[0].gainKg).toBe(0);
    });
  });
});
