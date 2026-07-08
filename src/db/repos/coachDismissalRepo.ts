/**
 * Coach-dismissal state — device-local (per-device UI state, never synced).
 * Stored as a small JSON array in AsyncStorage; see src/db/local.ts.
 */
import { loadLocal, saveLocal } from '../local';
import type { CoachDismissal } from '../schema';

const KEY = 'weeko.coach_dismissals';

type StoredDismissal = { id: string; until: string | null; createdAt: string };

async function load(): Promise<StoredDismissal[]> {
  return loadLocal<StoredDismissal[]>(KEY, []);
}

export async function listDismissals(): Promise<CoachDismissal[]> {
  const rows = await load();
  return rows.map((r) => ({ ...r, userId: null, updatedAt: null }));
}

/** Upsert: dismissing the same insight again refreshes its window. */
export async function dismissInsight(
  id: string,
  until: string | null,
  createdAt: string
): Promise<void> {
  const rows = await load();
  const next = rows.filter((r) => r.id !== id);
  next.push({ id, until, createdAt });
  await saveLocal(KEY, next);
}

/** Housekeeping: drop dismissals older than the cutoff (their ids won't recur). */
export async function pruneDismissals(olderThanIso: string): Promise<void> {
  const rows = await load();
  await saveLocal(
    KEY,
    rows.filter((r) => r.createdAt >= olderThanIso)
  );
}
