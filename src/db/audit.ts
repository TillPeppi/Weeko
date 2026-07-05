/**
 * Sync audit fields (docs/SYNC_CONCEPT.md §3). Stamps `user_id` (owner) and
 * `updated_at` on writes to synced tables so rows are ready to upload once
 * PowerSync is activated. While signed out / local-only, `user_id` is null.
 *
 * Update-side stamping and the final population strategy are finalized when the
 * PowerSync engine is wired (its CRUD layer intercepts writes) — see
 * docs/POWERSYNC_SETUP.md. For now these columns are additive and harmless.
 */
import { nowIso } from './client';
import { useAuthStore } from '@/stores/authStore';

/** Current signed-in user id, or null (local-only / signed out). */
export function currentUserId(): string | null {
  return useAuthStore.getState().session?.user.id ?? null;
}

/** Ownership + timestamp to spread into an INSERT on a synced table. */
export function auditInsert(): { userId: string | null; updatedAt: string } {
  return { userId: currentUserId(), updatedAt: nowIso() };
}

/** Timestamp bump to spread into an UPDATE on a synced table. */
export function touch(): { updatedAt: string } {
  return { updatedAt: nowIso() };
}
