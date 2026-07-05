import { describe, expect, it } from 'vitest';
import type { ImportBlock, ImportDay } from './types';
import {
  checkBigTrainingBeforeHandballDay,
  checkBigTrainingBeforeSameDayHandball,
  checkOverlappingBlocks,
  checkRegenerationDays,
  checkWeekRules,
  isBigTraining,
} from './rules';

const block = (partial: Partial<ImportBlock>): ImportBlock => ({
  type: 'free',
  start: '18:00',
  end: '19:00',
  title: 'Block',
  ...partial,
});

const day = (date: string, blocks: ImportBlock[]): ImportDay => ({ date, blocks });

// KW 28/2026: Mon 06.07. – Sun 12.07.
const MON = '2026-07-06';
const TUE = '2026-07-07';
const WED = '2026-07-08';
const FRI = '2026-07-10';
const SAT = '2026-07-11';
const SUN = '2026-07-12';

describe('isBigTraining', () => {
  it('is false for non-training blocks regardless of length', () => {
    expect(isBigTraining(block({ type: 'work', start: '07:30', end: '17:00' }))).toBe(false);
  });

  it('uses explicit intensity when present', () => {
    expect(
      isBigTraining(
        block({ type: 'training', start: '18:00', end: '18:30', details: { intensity: 'high' } })
      )
    ).toBe(true);
    expect(
      isBigTraining(
        block({ type: 'training', start: '17:00', end: '19:00', details: { intensity: 'low' } })
      )
    ).toBe(false);
  });

  it('falls back to duration >= 60 min', () => {
    expect(isBigTraining(block({ type: 'training', start: '18:00', end: '19:00' }))).toBe(true);
    expect(isBigTraining(block({ type: 'training', start: '18:00', end: '18:30' }))).toBe(false);
  });
});

describe('rule 1: big training before handball day', () => {
  it('warns when a big session precedes a handball day', () => {
    const days = [
      day(SUN, [block({ type: 'training', start: '10:00', end: '11:30', title: 'Hyrox' })]),
      // next Monday is outside this week, so use Sun -> Mon? Instead: Sat big training, Sun handball
    ];
    const days2 = [
      day(SAT, [block({ type: 'training', start: '10:00', end: '11:30', title: 'Hyrox' })]),
      day(SUN, [block({ type: 'handball', start: '18:00', end: '20:00', title: 'Spiel' })]),
    ];
    expect(checkBigTrainingBeforeHandballDay(days)).toHaveLength(0);
    const warnings = checkBigTrainingBeforeHandballDay(days2);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].rule).toBe('bigTrainingBeforeHandballDay');
    expect(warnings[0].date).toBe(SAT);
  });

  it('does not warn for short/low-intensity training', () => {
    const days = [
      day(MON, [
        block({
          type: 'training',
          start: '21:00',
          end: '21:25',
          title: 'Kurz-OK',
          details: { intensity: 'low' },
        }),
      ]),
      day(TUE, [block({ type: 'handball', start: '20:00', end: '22:00', title: 'Training' })]),
    ];
    expect(checkBigTrainingBeforeHandballDay(days)).toHaveLength(0);
  });
});

describe('rule 2: regeneration anchors Wed & Sun', () => {
  it('warns for intense training on Wednesday and Sunday', () => {
    const days = [
      day(WED, [block({ type: 'training', start: '18:00', end: '19:30', title: 'Kraft' })]),
      day(SUN, [block({ type: 'training', start: '10:00', end: '11:00', title: 'Hyrox' })]),
      day(FRI, [block({ type: 'training', start: '18:00', end: '19:30', title: 'Kraft' })]),
    ];
    const warnings = checkRegenerationDays(days);
    expect(warnings).toHaveLength(2);
    expect(warnings.map((w) => w.date).sort()).toEqual([WED, SUN]);
  });
});

describe('rule 3: big session with handball later the same day', () => {
  it('warns when handball follows the session', () => {
    const days = [
      day(TUE, [
        block({ type: 'training', start: '17:00', end: '18:30', title: 'Kraft' }),
        block({ type: 'handball', start: '20:00', end: '22:00', title: 'Training' }),
      ]),
    ];
    expect(checkBigTrainingBeforeSameDayHandball(days)).toHaveLength(1);
  });

  it('does not warn when the session is after handball', () => {
    const days = [
      day(MON, [
        block({ type: 'handball', start: '18:30', end: '20:30', title: 'Training' }),
        block({ type: 'training', start: '21:00', end: '22:30', title: 'Spät-Session' }),
      ]),
    ];
    expect(checkBigTrainingBeforeSameDayHandball(days)).toHaveLength(0);
  });
});

describe('rule 4: overlapping blocks', () => {
  it('detects overlaps, ignores touching blocks', () => {
    const days = [
      day(MON, [
        block({ start: '08:00', end: '10:00', title: 'A' }),
        block({ start: '09:30', end: '11:00', title: 'B' }),
        block({ start: '11:00', end: '12:00', title: 'C' }),
      ]),
    ];
    const warnings = checkOverlappingBlocks(days);
    expect(warnings).toHaveLength(1);
    expect(warnings[0].params).toMatchObject({ titleA: 'A', titleB: 'B' });
  });
});

describe('checkWeekRules', () => {
  it('aggregates all rules', () => {
    const days = [
      day(WED, [
        block({ type: 'training', start: '18:00', end: '19:30', title: 'Kraft' }),
        block({ type: 'hobby', start: '19:00', end: '20:00', title: 'Trading' }),
      ]),
    ];
    const warnings = checkWeekRules({ days });
    expect(warnings.map((w) => w.rule)).toEqual(
      expect.arrayContaining(['trainingOnRegenerationDay', 'overlappingBlocks'])
    );
  });
});
