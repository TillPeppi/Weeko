import { describe, expect, it } from 'vitest';
import type { FoodEntryLike } from '../nutritionStats';
import type { BlockLike, CoachContext, TrainingSetLike } from './context';
import {
  highTrainingStreak,
  lowProteinTrend,
  lowReadinessBeforeIntense,
  progressionStalled,
  regenerationDayIntense,
  runCoach,
  trainingConsistencyPraise,
} from './insights';

// KW 28/2026: Mon 06.07. – Sun 12.07. Wed 08.07. is a regeneration anchor.
const TODAY = '2026-07-08';
const THU = '2026-07-09'; // non-regeneration weekday

const proteinEntry = (date: string, protein: number): FoodEntryLike => ({
  date,
  meal: 'lunch',
  name: 'Protein',
  amountG: 100,
  nutrients: { kcal: 150, protein, carbs: 0, fat: 0 },
});

const bigTraining: BlockLike = {
  type: 'training',
  start: '18:00',
  end: '19:30',
  title: 'Hyrox',
  status: 'planned',
};

const weighted = (
  exerciseId: number,
  sessionId: number,
  date: string,
  weightKg: number
): TrainingSetLike => ({ exerciseId, sessionId, date, reps: 1, weightKg, done: true });

const ctx = (overrides: Partial<CoachContext> = {}): CoachContext => ({
  now: new Date('2026-07-08T07:00:00'),
  today: TODAY,
  profile: null,
  todayBlocks: [],
  nutritionEntries: [],
  trainingDates: [],
  trainingSets: [],
  exerciseNames: {},
  health: { hrvMs: null, restingHr: null, asleepMinutes: null },
  ...overrides,
});

describe('lowReadinessBeforeIntense', () => {
  it('warns when readiness is low and an intense session is still planned', () => {
    const result = lowReadinessBeforeIntense(
      ctx({ health: { hrvMs: null, restingHr: null, asleepMinutes: 120 }, todayBlocks: [bigTraining] })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'warning',
      category: 'recovery',
      key: 'coach.insights.lowReadinessIntense',
      params: { title: 'Hyrox', score: 25 },
    });
  });

  it('stays silent when readiness is fine', () => {
    expect(
      lowReadinessBeforeIntense(
        ctx({ health: { hrvMs: null, restingHr: null, asleepMinutes: 480 }, todayBlocks: [bigTraining] })
      )
    ).toEqual([]);
  });

  it('stays silent without any health data', () => {
    expect(lowReadinessBeforeIntense(ctx({ todayBlocks: [bigTraining] }))).toEqual([]);
  });

  it('does not warn about a short/low-intensity or already-done session', () => {
    const low = ctx({
      health: { hrvMs: null, restingHr: null, asleepMinutes: 120 },
      todayBlocks: [
        { ...bigTraining, end: '18:20' }, // 20 min → not "big"
        { ...bigTraining, details: { intensity: 'low' } },
        { ...bigTraining, status: 'done' },
      ],
    });
    expect(lowReadinessBeforeIntense(low)).toEqual([]);
  });
});

describe('lowProteinTrend', () => {
  const week = ['2026-07-06', '2026-07-07', '2026-07-08'];

  it('nudges when weekly Ø protein is well below target across enough days', () => {
    const result = lowProteinTrend(
      ctx({ nutritionEntries: week.map((d) => proteinEntry(d, 50)) })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'suggestion',
      category: 'nutrition',
      key: 'coach.insights.lowProteinTrend',
      params: { avg: 50, target: 110 },
    });
  });

  it('stays silent below the minimum tracked-day count', () => {
    expect(
      lowProteinTrend(ctx({ nutritionEntries: week.slice(0, 2).map((d) => proteinEntry(d, 50)) }))
    ).toEqual([]);
  });

  it('stays silent when protein is on target', () => {
    expect(
      lowProteinTrend(ctx({ nutritionEntries: week.map((d) => proteinEntry(d, 100)) }))
    ).toEqual([]);
  });
});

describe('trainingConsistencyPraise', () => {
  it('praises 4+ training days in the trailing week', () => {
    const result = trainingConsistencyPraise(
      ctx({ trainingDates: ['2026-07-03', '2026-07-05', '2026-07-06', '2026-07-08'] })
    );
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ kind: 'praise', params: { days: 4 } });
  });

  it('ignores training days outside the trailing 7 days', () => {
    expect(
      trainingConsistencyPraise(
        ctx({ trainingDates: ['2026-06-01', '2026-06-02', '2026-06-03', '2026-07-08'] })
      )
    ).toEqual([]);
  });
});

describe('regenerationDayIntense', () => {
  it('warns about an intense session on a regeneration day (Wed/Sun)', () => {
    const result = regenerationDayIntense(ctx({ todayBlocks: [bigTraining] }));
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      kind: 'warning',
      key: 'coach.insights.regenerationDayIntense',
      params: { title: 'Hyrox' },
    });
  });

  it('stays silent on a non-regeneration weekday', () => {
    expect(regenerationDayIntense(ctx({ today: THU, todayBlocks: [bigTraining] }))).toEqual([]);
  });

  it('stays silent without an intense session', () => {
    expect(regenerationDayIntense(ctx())).toEqual([]);
  });
});

describe('highTrainingStreak', () => {
  it('warns after 5 consecutive training days', () => {
    const result = highTrainingStreak(
      ctx({
        trainingDates: ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08'],
      })
    );
    expect(result[0]).toMatchObject({ kind: 'warning', params: { days: 5 } });
  });

  it('stays silent below the threshold', () => {
    expect(
      highTrainingStreak(ctx({ trainingDates: ['2026-07-06', '2026-07-07', '2026-07-08'] }))
    ).toEqual([]);
  });
});

describe('progressionStalled', () => {
  const stalledSets = [100, 110, 105, 105, 105].map((w, i) =>
    weighted(7, i + 1, `2026-06-${String(i + 1).padStart(2, '0')}`, w)
  );

  it('suggests progressing a stalled, named exercise', () => {
    const result = progressionStalled(
      ctx({ trainingSets: stalledSets, exerciseNames: { 7: 'Klimmzüge' } })
    );
    expect(result[0]).toMatchObject({
      kind: 'suggestion',
      key: 'coach.insights.progressionStalled',
      params: { exercise: 'Klimmzüge', sessions: 3, weight: 105 },
    });
  });

  it('stays silent when the exercise name is unknown', () => {
    expect(progressionStalled(ctx({ trainingSets: stalledSets, exerciseNames: {} }))).toEqual([]);
  });
});

describe('runCoach', () => {
  it('collects insights from all rules, most urgent first', () => {
    // TODAY is Wed (regen day) with a pending intense session → regen warning too
    const insights = runCoach(
      ctx({
        health: { hrvMs: null, restingHr: null, asleepMinutes: 120 },
        todayBlocks: [bigTraining],
        nutritionEntries: ['2026-07-06', '2026-07-07', '2026-07-08'].map((d) => proteinEntry(d, 50)),
        trainingDates: ['2026-07-03', '2026-07-05', '2026-07-06', '2026-07-08'],
      })
    );
    expect(insights.map((i) => i.kind)).toEqual(['warning', 'warning', 'suggestion', 'praise']);
    expect(insights.map((i) => i.score)).toEqual([90, 70, 55, 30]);
  });

  it('returns nothing when everything looks fine', () => {
    expect(runCoach(ctx({ today: THU }))).toEqual([]);
  });
});
