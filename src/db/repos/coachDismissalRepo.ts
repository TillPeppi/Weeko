import { lt } from 'drizzle-orm';
import { db } from '../client';
import { coachDismissal, type CoachDismissal } from '../schema';

export async function listDismissals(): Promise<CoachDismissal[]> {
  return db.select().from(coachDismissal);
}

/** Upsert: dismissing the same insight again refreshes its window. */
export async function dismissInsight(
  id: string,
  until: string | null,
  createdAt: string
): Promise<void> {
  await db
    .insert(coachDismissal)
    .values({ id, until, createdAt })
    .onConflictDoUpdate({ target: coachDismissal.id, set: { until, createdAt } });
}

/** Housekeeping: drop dismissals older than the cutoff (their ids won't recur). */
export async function pruneDismissals(olderThanIso: string): Promise<void> {
  await db.delete(coachDismissal).where(lt(coachDismissal.createdAt, olderThanIso));
}
