/**
 * PowerSync ↔ Supabase connector — SCAFFOLD, not yet wired (docs/POWERSYNC_SETUP.md).
 *
 * `fetchCredentials` hands PowerSync the Supabase session token + the PowerSync
 * instance URL; `uploadData` drains the local write queue to Supabase (RLS +
 * `user_id` default enforce per-user isolation). Types come from
 * `@powersync/common` so this file stays platform-neutral (no RN/web runtime pull).
 */
import {
  UpdateType,
  type AbstractPowerSyncDatabase,
  type PowerSyncBackendConnector,
  type PowerSyncCredentials,
} from '@powersync/common';
import { getSupabase } from '@/auth/supabase';

const POWERSYNC_URL = process.env.EXPO_PUBLIC_POWERSYNC_URL;

// Postgres/Supabase error codes that are permanent (bad data) — discard the op
// instead of blocking the queue forever.
const FATAL_RESPONSE_CODES = [/^22\d{3}$/, /^23\d{3}$/, /^42\d{3}$/];

export class SupabaseConnector implements PowerSyncBackendConnector {
  async fetchCredentials(): Promise<PowerSyncCredentials | null> {
    const sb = getSupabase();
    if (!sb || !POWERSYNC_URL) return null;
    const {
      data: { session },
    } = await sb.auth.getSession();
    if (!session) return null;
    return { endpoint: POWERSYNC_URL, token: session.access_token ?? '' };
  }

  async uploadData(database: AbstractPowerSyncDatabase): Promise<void> {
    const sb = getSupabase();
    if (!sb) return;

    const transaction = await database.getNextCrudTransaction();
    if (!transaction) return;

    try {
      for (const op of transaction.crud) {
        const table = sb.from(op.table);
        let result;
        switch (op.op) {
          case UpdateType.PUT:
            result = await table.upsert({ ...op.opData, id: op.id });
            break;
          case UpdateType.PATCH:
            result = await table.update(op.opData ?? {}).eq('id', op.id);
            break;
          case UpdateType.DELETE:
            result = await table.delete().eq('id', op.id);
            break;
        }
        if (result?.error) throw result.error;
      }
      await transaction.complete();
    } catch (ex) {
      const code = (ex as { code?: string }).code;
      if (typeof code === 'string' && FATAL_RESPONSE_CODES.some((re) => re.test(code))) {
        // permanent failure — drop the op so the queue can progress
        await transaction.complete();
      } else {
        throw ex; // transient — retry later
      }
    }
  }
}
