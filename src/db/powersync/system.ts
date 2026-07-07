/**
 * PowerSync system wiring. Lazy — nothing opens SQLite until first use, so the
 * web static-render pass stays untouched (docs/POWERSYNC_SETUP.md).
 */
import { wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { createPowerSyncDatabase } from './factory';
import { drizzleSyncSchema } from './schema';
import { SupabaseConnector } from './connector';

/** True once a PowerSync instance URL is configured. */
export const isPowerSyncConfigured = Boolean(process.env.EXPO_PUBLIC_POWERSYNC_URL);

let powerSync: AbstractPowerSyncDatabase | null = null;
let drizzleDb: ReturnType<typeof wrapPowerSyncWithDrizzle> | null = null;
let connector: SupabaseConnector | null = null;

/** The PowerSync database (lazy singleton). */
export function getPowerSync(): AbstractPowerSyncDatabase {
  if (!powerSync) powerSync = createPowerSyncDatabase();
  return powerSync;
}

/** Drizzle instance backed by PowerSync — the app's `db` (lazy singleton). */
export function getSyncDb() {
  if (!drizzleDb) {
    drizzleDb = wrapPowerSyncWithDrizzle(getPowerSync(), { schema: drizzleSyncSchema });
  }
  return drizzleDb;
}

/** Start syncing (call when a Supabase session exists + PowerSync is configured). */
export async function connectSync(): Promise<void> {
  if (!isPowerSyncConfigured) return;
  if (!connector) connector = new SupabaseConnector();
  await getPowerSync().connect(connector);
}

/** Stop syncing (e.g. on sign-out). */
export async function disconnectSync(): Promise<void> {
  if (powerSync) await powerSync.disconnect();
}
