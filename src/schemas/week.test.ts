import { describe, expect, it } from 'vitest';
import { parseWeekImport } from '@/domain/parseWeekImport';

const validWeek = {
  schemaVersion: 1,
  week: { year: 2026, isoWeek: 28 },
  days: [
    {
      date: '2026-07-06',
      blocks: [
        { type: 'work', start: '07:30', end: '17:00', title: 'Arbeit (Office)' },
        { type: 'handball', start: '18:30', end: '20:30', title: 'Handball' },
      ],
    },
    {
      date: '2026-07-10',
      blocks: [
        {
          type: 'training',
          start: '18:00',
          end: '19:30',
          title: 'Weighted Calisthenics',
          details: { sessionTemplate: 'weighted-calisthenics', intensity: 'high' },
        },
      ],
    },
  ],
  tasks: [
    {
      title: 'Meal-Prep',
      category: 'mealprep',
      estimatedMinutes: 45,
      preferredWindow: { day: '2026-07-08', start: '18:00', end: '20:00' },
      context: { location: 'home' },
    },
  ],
};

describe('parseWeekImport', () => {
  it('accepts a valid week and returns rule warnings', () => {
    const result = parseWeekImport(JSON.stringify(validWeek));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.week.week.isoWeek).toBe(28);
    expect(result.week.days).toHaveLength(2);
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('rejects broken JSON with a localized key', () => {
    const result = parseWeekImport('{ nope');
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors[0].key).toBe('week.import.errors.invalidJson');
  });

  it('rejects end <= start with day/block location', () => {
    const bad = structuredClone(validWeek);
    bad.days[0].blocks[1] = { type: 'handball', start: '20:30', end: '18:30', title: 'Handball' };
    const result = parseWeekImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    const issue = result.errors.find((e) => e.key === 'week.import.errors.endBeforeStart');
    expect(issue).toBeDefined();
    expect(issue).toMatchObject({ day: 1, block: 2, field: 'end' });
  });

  it('rejects blocks outside 05:00–24:00', () => {
    const bad = structuredClone(validWeek);
    bad.days[0].blocks[0] = { type: 'work', start: '04:00', end: '06:00', title: 'Früh' };
    const result = parseWeekImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === 'week.import.errors.outsideDayBounds')).toBe(true);
  });

  it('rejects invalid block types', () => {
    const bad = structuredClone(validWeek) as Record<string, unknown>;
    (bad as typeof validWeek).days[0].blocks[0].type = 'yoga' as never;
    const result = parseWeekImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === 'week.import.errors.invalidBlockType')).toBe(true);
  });

  it('rejects unsupported schema versions', () => {
    const bad = { ...structuredClone(validWeek), schemaVersion: 2 };
    const result = parseWeekImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === 'week.import.errors.unsupportedVersion')).toBe(true);
  });

  it('rejects dates outside the declared ISO week and duplicates', () => {
    const bad = structuredClone(validWeek);
    bad.days[1].date = '2026-07-13'; // Monday of week 29
    const result = parseWeekImport(JSON.stringify(bad));
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.some((e) => e.key === 'week.import.errors.dateOutsideWeek')).toBe(true);

    const dup = structuredClone(validWeek);
    dup.days[1].date = dup.days[0].date;
    dup.days[1].blocks = [{ type: 'free', start: '18:00', end: '19:00', title: 'Frei' }];
    const dupResult = parseWeekImport(JSON.stringify(dup));
    expect(dupResult.ok).toBe(false);
    if (dupResult.ok) return;
    expect(dupResult.errors.some((e) => e.key === 'week.import.errors.duplicateDate')).toBe(true);
  });

  it('flags rule warnings without failing the import', () => {
    const wk = structuredClone(validWeek);
    // Big training on Wednesday (regeneration anchor)
    wk.days[1] = {
      date: '2026-07-08',
      blocks: [
        {
          type: 'training',
          start: '18:00',
          end: '19:30',
          title: 'Hyrox',
          details: { sessionTemplate: 'hyrox', intensity: 'high' },
        },
      ],
    };
    const result = parseWeekImport(JSON.stringify(wk));
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.warnings.some((w) => w.rule === 'trainingOnRegenerationDay')).toBe(true);
  });
});
