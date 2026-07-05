/**
 * The insight engine — Weeko's "AI", built entirely from deterministic rules
 * over the CoachContext snapshot. Each rule is a pure function returning zero
 * or more Insights; runCoach runs the bank and sorts by urgency.
 *
 * Every insight carries an i18n key (coach.insights.*) and a stable id so the
 * UI can de-duplicate and "don't show again". No React/Expo imports.
 *
 * This is intentionally the same shape as the import rule engine (rules.ts):
 * small, testable, explainable — you can always answer "why did this tip
 * appear?" by pointing at the rule.
 */
import { addDaysIso, durationMinutes, isoWeekday } from '../time';
import { dailyTargets } from '../nutrition';
import { weeklyNutrition } from '../nutritionStats';
import { BIG_TRAINING_MINUTES, REGENERATION_WEEKDAYS } from '../rules';
import type { CoachContext, BlockLike } from './context';
import { readinessScore } from './readiness';
import { currentTrainingStreak, stalledExercise } from './trainingSignals';

export type InsightKind = 'suggestion' | 'warning' | 'praise' | 'nudge';
export type InsightCategory = 'training' | 'nutrition' | 'recovery' | 'planning';

export interface Insight {
  /** stable across runs of the same underlying fact (for dedup / dismiss) */
  id: string;
  kind: InsightKind;
  category: InsightCategory;
  /** i18n key under coach.insights.* */
  key: string;
  params: Record<string, string | number>;
  /** 0–100 urgency × relevance; drives ordering and the push threshold */
  score: number;
  /**
   * Dismiss policy: set → dismissing snoozes for this many minutes (actionable
   * insights reappear later); unset → dismissing hides permanently until the
   * underlying fact/id changes (informational insights).
   */
  snoozeMinutes?: number;
}

export type CoachRule = (ctx: CoachContext) => Insight[];

// --- Tuning constants (exported so tests & settings can reference them) ------

/** Below this readiness score, an intense session gets flagged. */
export const LOW_READINESS_THRESHOLD = 40;
/** Weekly Ø protein below this fraction of the target triggers a nudge. */
export const PROTEIN_MIN_RATIO = 0.8;
/** Need at least this many tracked days before judging the protein trend. */
export const PROTEIN_MIN_TRACKED_DAYS = 3;
/** Training days in the last 7 that earn a consistency praise. */
export const PRAISE_TRAINING_DAYS = 4;
/** Consecutive training days that trigger a rest-day warning. */
export const REST_DAY_STREAK_THRESHOLD = 5;
/** Snooze window (minutes) for a dismissed actionable warning. */
export const WARNING_SNOOZE_MINUTES = 180;

function isPending(status: BlockLike['status']): boolean {
  return status === 'planned' || status === 'active';
}

/** A still-open training block that counts as a "big" session today. */
function pendingBigTraining(ctx: CoachContext): BlockLike | undefined {
  return ctx.todayBlocks.find((b) => {
    if (b.type !== 'training' || !isPending(b.status)) return false;
    const intensity = b.details?.['intensity'];
    if (intensity === 'high') return true;
    if (intensity === 'low') return false;
    return durationMinutes(b.start, b.end) >= BIG_TRAINING_MINUTES;
  });
}

// --- Rules -------------------------------------------------------------------

/** Warn when readiness is low but an intense session is still planned today. */
export const lowReadinessBeforeIntense: CoachRule = (ctx) => {
  const readiness = readinessScore(ctx.health, ctx.readinessBaseline);
  if (!readiness || readiness.score >= LOW_READINESS_THRESHOLD) return [];
  const session = pendingBigTraining(ctx);
  if (!session) return [];
  return [
    {
      id: `recovery-low-${ctx.today}`,
      kind: 'warning',
      category: 'recovery',
      key: 'coach.insights.lowReadinessIntense',
      params: { score: readiness.score, title: session.title },
      score: 90,
      snoozeMinutes: WARNING_SNOOZE_MINUTES,
    },
  ];
};

/** Nudge when this week's Ø protein is well below target across enough days. */
export const lowProteinTrend: CoachRule = (ctx) => {
  const [week] = weeklyNutrition(ctx.nutritionEntries, ctx.today, 1);
  if (!week || week.trackedDays < PROTEIN_MIN_TRACKED_DAYS) return [];
  const target = dailyTargets(ctx.profile).proteinMin;
  if (week.avgProtein >= target * PROTEIN_MIN_RATIO) return [];
  return [
    {
      id: `protein-low-${week.year}-${week.isoWeek}`,
      kind: 'suggestion',
      category: 'nutrition',
      key: 'coach.insights.lowProteinTrend',
      params: { avg: week.avgProtein, target },
      score: 55,
    },
  ];
};

/** Praise consistent training over the trailing 7 days. */
export const trainingConsistencyPraise: CoachRule = (ctx) => {
  const weekAgo = addDaysIso(ctx.today, -6);
  const days = new Set(ctx.trainingDates.filter((d) => d >= weekAgo && d <= ctx.today));
  if (days.size < PRAISE_TRAINING_DAYS) return [];
  return [
    {
      id: `praise-training-${ctx.today}`,
      kind: 'praise',
      category: 'training',
      key: 'coach.insights.trainingConsistency',
      params: { days: days.size },
      score: 30,
    },
  ];
};

/** Warn when an intense session is planned on a regeneration anchor (Wed/Sun). */
export const regenerationDayIntense: CoachRule = (ctx) => {
  if (!REGENERATION_WEEKDAYS.includes(isoWeekday(ctx.today))) return [];
  const session = pendingBigTraining(ctx);
  if (!session) return [];
  return [
    {
      id: `regen-day-${ctx.today}`,
      kind: 'warning',
      category: 'recovery',
      key: 'coach.insights.regenerationDayIntense',
      params: { title: session.title },
      score: 70,
      snoozeMinutes: WARNING_SNOOZE_MINUTES,
    },
  ];
};

/** Warn after many consecutive training days without a rest day. */
export const highTrainingStreak: CoachRule = (ctx) => {
  const streak = currentTrainingStreak(ctx.trainingDates, ctx.today);
  if (streak < REST_DAY_STREAK_THRESHOLD) return [];
  return [
    {
      id: `load-streak-${ctx.today}`,
      kind: 'warning',
      category: 'recovery',
      key: 'coach.insights.highTrainingStreak',
      params: { days: streak },
      score: 60,
      snoozeMinutes: WARNING_SNOOZE_MINUTES,
    },
  ];
};

/** Suggest progressing an exercise whose estimated 1RM hasn't set a PR lately. */
export const progressionStalled: CoachRule = (ctx) => {
  const stalled = stalledExercise(ctx.trainingSets);
  if (!stalled) return [];
  const exercise = ctx.exerciseNames[stalled.exerciseId];
  if (!exercise) return [];
  return [
    {
      id: `stall-${stalled.exerciseId}-${stalled.sessionsSincePr}`,
      kind: 'suggestion',
      category: 'training',
      key: 'coach.insights.progressionStalled',
      params: { exercise, sessions: stalled.sessionsSincePr, weight: stalled.lastWeightKg },
      score: 45,
    },
  ];
};

/** The rule bank — extend here as new heuristics are added. */
export const COACH_RULES: CoachRule[] = [
  lowReadinessBeforeIntense,
  regenerationDayIntense,
  highTrainingStreak,
  lowProteinTrend,
  progressionStalled,
  trainingConsistencyPraise,
];

/** Runs every rule and returns the insights sorted most-urgent first. */
export function runCoach(ctx: CoachContext): Insight[] {
  return COACH_RULES.flatMap((rule) => rule(ctx)).sort((a, b) => b.score - a.score);
}
