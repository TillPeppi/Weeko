import { describe, expect, it } from 'vitest';
import {
  avgSessionMinutes,
  trainingCounts,
  trainingStreaks,
  weeklyTraining,
} from './trainingStats';

describe('trainingCounts', () => {
  // 2026-07-03 is a Friday in ISO week 27
  const today = '2026-07-03';

  it('counts distinct training days per ISO week, month and year', () => {
    const counts = trainingCounts(
      [
        '2026-06-29', // Monday same ISO week, previous month
        '2026-07-01', // same week + month
        '2026-07-01', // duplicate day — counts once
        '2026-07-03',
        '2026-07-10', // same month, next week
        '2026-01-15', // same year only
        '2025-12-30', // previous year
      ],
      today
    );
    expect(counts.week).toBe(3); // 29.6., 1.7., 3.7.
    expect(counts.month).toBe(3); // 1.7., 3.7., 10.7.
    expect(counts.year).toBe(5);
  });

  it('handles the year boundary (ISO week spanning December/January)', () => {
    // 2026-01-01 is a Thursday in ISO week 1 of 2026; 2025-12-29 (Mon) is too
    const counts = trainingCounts(['2025-12-29', '2026-01-01'], '2026-01-01');
    expect(counts.week).toBe(2);
    expect(counts.year).toBe(1);
  });

  it('handles no data', () => {
    expect(trainingCounts([], today)).toEqual({ week: 0, month: 0, year: 0 });
  });
});

describe('weeklyTraining', () => {
  // 2026-07-03 (Fri) is in ISO week 27; Monday is 2026-06-29
  const today = '2026-07-03';

  it('aggregates sessions, distinct days and done-set volume per ISO week', () => {
    const points = weeklyTraining(
      ['2026-06-29', '2026-07-01', '2026-07-01', '2026-06-24'],
      [
        { date: '2026-06-29', reps: 10, weightKg: 16, done: true },
        { date: '2026-07-01', reps: 5, weightKg: 20, done: true },
        { date: '2026-07-01', reps: 5, weightKg: 20, done: false }, // unchecked
        { date: '2026-06-24', reps: 8, weightKg: 10, done: true }, // previous week
      ],
      today,
      2
    );
    expect(points).toHaveLength(2);
    expect(points[0]).toMatchObject({ isoWeek: 26, sessions: 1, days: 1, volumeKg: 80 });
    expect(points[1]).toMatchObject({ isoWeek: 27, sessions: 3, days: 2, volumeKg: 260 });
    expect(points[1].monday).toBe('2026-06-29');
  });

  it('returns zeroed weeks without data', () => {
    const points = weeklyTraining([], [], today, 3);
    expect(points).toHaveLength(3);
    expect(points.every((p) => p.sessions === 0 && p.volumeKg === 0)).toBe(true);
  });
});

describe('trainingStreaks', () => {
  const today = '2026-07-03'; // ISO week 27 (Monday 2026-06-29)

  it('counts current and longest week streaks', () => {
    const { currentWeeks, longestWeeks } = trainingStreaks(
      ['2026-06-30', '2026-06-23', '2026-06-16', '2026-05-05', '2026-04-28', '2026-04-21'],
      today
    );
    expect(currentWeeks).toBe(3);
    expect(longestWeeks).toBe(3);
  });

  it('does not break the streak when the current week is still empty', () => {
    // trained last week + the week before, nothing yet this week
    const { currentWeeks } = trainingStreaks(['2026-06-26', '2026-06-17'], today);
    expect(currentWeeks).toBe(2);
  });

  it('resets the current streak after a gap week', () => {
    const { currentWeeks, longestWeeks } = trainingStreaks(['2026-06-10', '2026-06-03'], today);
    expect(currentWeeks).toBe(0);
    expect(longestWeeks).toBe(2);
  });

  it('handles no data', () => {
    expect(trainingStreaks([], today)).toEqual({ currentWeeks: 0, longestWeeks: 0 });
  });
});

describe('avgSessionMinutes', () => {
  it('averages finished sessions only', () => {
    expect(
      avgSessionMinutes([
        { startedAt: '2026-07-01T18:00:00.000Z', endedAt: '2026-07-01T19:00:00.000Z' },
        { startedAt: '2026-07-03T18:00:00.000Z', endedAt: '2026-07-03T18:30:00.000Z' },
        { startedAt: '2026-07-04T18:00:00.000Z', endedAt: null },
      ])
    ).toBe(45);
  });

  it('returns null without usable sessions', () => {
    expect(avgSessionMinutes([])).toBeNull();
  });
});
