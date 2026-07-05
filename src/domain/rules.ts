/**
 * Rule engine for imported weeks (requirements §7.3).
 * All results are WARNINGS the user may override — hard failures
 * (end <= start, blocks outside 05:00–24:00) live in the Zod schema.
 *
 * Pure functions, no React/Expo imports. Every warning carries an i18n key.
 */
import type { ImportBlock, ImportDay, WeekImport } from './types';
import { addDaysIso, durationMinutes, isoWeekday, timesOverlap, toMinutes } from './time';

export type RuleId =
  | 'bigTrainingBeforeHandballDay'
  | 'trainingOnRegenerationDay'
  | 'bigTrainingBeforeSameDayHandball'
  | 'overlappingBlocks';

export interface RuleWarning {
  rule: RuleId;
  /** i18n key under week.import.warnings.* */
  key: string;
  params: Record<string, string | number>;
  /** date the warning anchors to (for highlighting in the preview) */
  date: string;
}

/** Minutes from which a training block counts as a "big" session. */
export const BIG_TRAINING_MINUTES = 60;

/** ISO weekdays that are regeneration anchors: Wednesday (3) and Sunday (7). */
export const REGENERATION_WEEKDAYS: readonly number[] = [3, 7];

export function isBigTraining(block: ImportBlock): boolean {
  if (block.type !== 'training') return false;
  const intensity = block.details?.['intensity'];
  if (intensity === 'high') return true;
  if (intensity === 'low') return false;
  return durationMinutes(block.start, block.end) >= BIG_TRAINING_MINUTES;
}

function hasHandball(day: ImportDay): boolean {
  return day.blocks.some((b) => b.type === 'handball');
}

function sortedDays(days: ImportDay[]): ImportDay[] {
  return [...days].sort((a, b) => a.date.localeCompare(b.date));
}

/** Rule 1: no big own training on the day before a handball day. */
export function checkBigTrainingBeforeHandballDay(days: ImportDay[]): RuleWarning[] {
  const byDate = new Map(days.map((d) => [d.date, d]));
  const warnings: RuleWarning[] = [];
  for (const day of days) {
    const nextDay = byDate.get(addDaysIso(day.date, 1));
    if (!nextDay || !hasHandball(nextDay)) continue;
    for (const block of day.blocks) {
      if (isBigTraining(block)) {
        warnings.push({
          rule: 'bigTrainingBeforeHandballDay',
          key: 'week.import.warnings.bigTrainingBeforeHandballDay',
          params: { date: day.date, title: block.title, nextDate: nextDay.date },
          date: day.date,
        });
      }
    }
  }
  return warnings;
}

/** Rule 2: Wednesday & Sunday are regeneration anchors — no intense training. */
export function checkRegenerationDays(days: ImportDay[]): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  for (const day of days) {
    if (!REGENERATION_WEEKDAYS.includes(isoWeekday(day.date))) continue;
    for (const block of day.blocks) {
      if (isBigTraining(block)) {
        warnings.push({
          rule: 'trainingOnRegenerationDay',
          key: 'week.import.warnings.trainingOnRegenerationDay',
          params: { date: day.date, title: block.title },
          date: day.date,
        });
      }
    }
  }
  return warnings;
}

/** Rule 3: big sessions only on days without handball later the same day. */
export function checkBigTrainingBeforeSameDayHandball(days: ImportDay[]): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  for (const day of days) {
    const handballStarts = day.blocks
      .filter((b) => b.type === 'handball')
      .map((b) => toMinutes(b.start));
    if (handballStarts.length === 0) continue;
    for (const block of day.blocks) {
      if (isBigTraining(block) && handballStarts.some((h) => h >= toMinutes(block.end))) {
        warnings.push({
          rule: 'bigTrainingBeforeSameDayHandball',
          key: 'week.import.warnings.bigTrainingBeforeSameDayHandball',
          params: { date: day.date, title: block.title },
          date: day.date,
        });
      }
    }
  }
  return warnings;
}

/** Rule 4: overlapping blocks on the same day. */
export function checkOverlappingBlocks(days: ImportDay[]): RuleWarning[] {
  const warnings: RuleWarning[] = [];
  for (const day of days) {
    for (let i = 0; i < day.blocks.length; i++) {
      for (let j = i + 1; j < day.blocks.length; j++) {
        const a = day.blocks[i];
        const b = day.blocks[j];
        if (timesOverlap(a.start, a.end, b.start, b.end)) {
          warnings.push({
            rule: 'overlappingBlocks',
            key: 'week.import.warnings.overlappingBlocks',
            params: { date: day.date, titleA: a.title, titleB: b.title },
            date: day.date,
          });
        }
      }
    }
  }
  return warnings;
}

/** Runs all import rules. Order matches requirements §7.3. */
export function checkWeekRules(week: Pick<WeekImport, 'days'>): RuleWarning[] {
  const days = sortedDays(week.days);
  return [
    ...checkBigTrainingBeforeHandballDay(days),
    ...checkRegenerationDays(days),
    ...checkBigTrainingBeforeSameDayHandball(days),
    ...checkOverlappingBlocks(days),
  ];
}
