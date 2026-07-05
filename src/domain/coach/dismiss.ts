/**
 * Dismiss logic for coach insights — pure, framework-free.
 *
 * Hybrid policy: informational insights (praise, trend suggestions) carry no
 * `snoozeMinutes`, so dismissing them hides them permanently (their id changes
 * when the underlying fact changes — e.g. next week's protein id). Actionable
 * insights (warnings) carry `snoozeMinutes`, so dismissing only snoozes them:
 * they reappear once `now` passes the stored `until`.
 */
import type { Insight } from './insights';

export interface Dismissal {
  id: string;
  /** ISO timestamp until which the insight stays hidden; null = permanent. */
  until: string | null;
}

/** Is this insight currently dismissed? */
export function isDismissed(
  insightId: string,
  dismissals: Dismissal[],
  nowIso: string
): boolean {
  const match = dismissals.find((d) => d.id === insightId);
  if (!match) return false;
  if (match.until === null) return true; // permanent
  return nowIso < match.until; // still within the snooze window
}

/** Drops insights that are currently dismissed. */
export function filterActiveInsights(
  insights: Insight[],
  dismissals: Dismissal[],
  nowIso: string
): Insight[] {
  return insights.filter((insight) => !isDismissed(insight.id, dismissals, nowIso));
}

/**
 * The `until` value to persist when dismissing: a snooze deadline for
 * actionable insights, or null (permanent) for informational ones. Actionable
 * insights use `snoozeOverrideMin` when given (the user's configured snooze),
 * else the insight's own default. `nowMs` is injected so this stays pure.
 */
export function dismissUntil(
  insight: Insight,
  nowMs: number,
  snoozeOverrideMin?: number | null
): string | null {
  if (insight.snoozeMinutes == null) return null;
  const minutes = snoozeOverrideMin ?? insight.snoozeMinutes;
  return new Date(nowMs + minutes * 60_000).toISOString();
}
