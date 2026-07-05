import { describe, expect, it } from 'vitest';
import {
  buildAnalysisExport,
  nutritionDaySummaries,
  sessionVolumeKg,
  type AnalysisExportInput,
  type ExportSession,
} from './analysisExport';
import { dailyTargets } from './nutrition';

const range = {
  mode: 'week' as const,
  start: '2026-06-29',
  end: '2026-07-05',
  label: 'KW 27/2026',
};

function baseInput(): AnalysisExportInput {
  return {
    range,
    profile: { age: 30, sex: 'male', heightCm: 183, weightKg: 80, goal: 'lean_gain' },
    targets: dailyTargets(null),
    blocks: [],
    tasks: [],
    sessions: [],
    foodEntries: [],
    measurements: [],
    healthDays: [],
  };
}

describe('nutritionDaySummaries', () => {
  it('aggregates entries per day, scaled by amount', () => {
    const summaries = nutritionDaySummaries([
      {
        date: '2026-07-01',
        name: 'Skyr',
        meal: 'breakfast',
        amountG: 300,
        nutrients: { kcal: 60, protein: 10, carbs: 4, fat: 0.2 },
      },
      {
        date: '2026-07-01',
        name: 'Reis',
        meal: 'lunch',
        amountG: 100,
        nutrients: { kcal: 350, protein: 7, carbs: 77, fat: 1 },
      },
      {
        date: '2026-06-30',
        name: 'Apfel',
        meal: 'snack',
        amountG: 150,
        nutrients: { kcal: 52, carbs: 14, fiber: 2.4 },
      },
    ]);
    expect(summaries).toHaveLength(2);
    // sorted oldest first
    expect(summaries[0].date).toBe('2026-06-30');
    expect(summaries[0].fiberG).toBeCloseTo(3.6, 1);
    expect(summaries[1]).toMatchObject({ date: '2026-07-01', entries: 2, kcal: 530 });
    expect(summaries[1].proteinG).toBeCloseTo(37, 1);
  });
});

describe('sessionVolumeKg', () => {
  it('sums reps × kg and skips sets without both values', () => {
    const session: ExportSession = {
      date: '2026-07-01',
      title: 'Push',
      durationMinutes: 60,
      exercises: [
        {
          name: 'Dips',
          sets: [
            { reps: 8, weightKg: 10 },
            { reps: 8, weightKg: 10 },
            { reps: 15, weightKg: null },
          ],
        },
      ],
    };
    expect(sessionVolumeKg(session)).toBe(160);
  });
});

describe('buildAnalysisExport', () => {
  it('omits empty sections and all-null health days', () => {
    const input = baseInput();
    input.healthDays = [
      { date: '2026-06-29', sleepMinutes: null, steps: null, restingHr: null, hrvMs: null },
    ];
    const result = buildAnalysisExport(input);
    expect(result.plan).toBeUndefined();
    expect(result.training).toBeUndefined();
    expect(result.nutrition).toBeUndefined();
    expect(result.body).toBeUndefined();
    expect(result.health).toBeUndefined();
    expect(result.range).toEqual(range);
  });

  it('includes adherence counts and compact set tuples', () => {
    const input = baseInput();
    input.blocks = [
      { date: '2026-06-29', type: 'work', title: 'Arbeit', start: '08:00', end: '16:00', status: 'done' },
      { date: '2026-06-30', type: 'training', title: 'Push', start: '18:00', end: '19:00', status: 'skipped' },
      { date: '2026-07-01', type: 'dog', title: 'Gassi', start: '07:00', end: '07:30', status: 'planned' },
    ];
    input.sessions = [
      {
        date: '2026-06-30',
        title: 'Push',
        durationMinutes: 55,
        exercises: [{ name: 'Dips', sets: [{ reps: 8, weightKg: 10 }] }],
      },
    ];
    input.healthDays = [
      { date: '2026-06-29', sleepMinutes: 440, steps: 9000, restingHr: 52, hrvMs: 65 },
    ];
    const result = buildAnalysisExport(input) as {
      plan: { adherence: { done: number; skipped: number; open: number } };
      training: { sessions: { volumeKg: number; exercises: { sets: unknown[] }[] }[] };
      health: unknown[];
    };
    expect(result.plan.adherence).toEqual({ done: 1, skipped: 1, open: 1 });
    expect(result.training.sessions[0].volumeKg).toBe(80);
    expect(result.training.sessions[0].exercises[0].sets).toEqual([[8, 10]]);
    expect(result.health).toHaveLength(1);
  });
});
