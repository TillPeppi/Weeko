/**
 * PowerSync system wiring — SCAFFOLD, not yet imported by the app
 * (docs/POWERSYNC_SETUP.md). Lazy so importing this file has no side effects
 * (no SQLite opened) until sync is actually activated.
 *
 * Activation (summary — full steps in the setup doc):
 *  1. Create a PowerSync Cloud instance connected to your Supabase Postgres,
 *     deploy powersync/sync-rules.yaml, set EXPO_PUBLIC_POWERSYNC_URL.
 *  2. In app/_layout.tsx, after auth hydrate + when signed in, call `connectSync()`.
 *  3. Point the repos' Drizzle instance at `getSyncDb()` instead of the
 *     expo-sqlite `db` (or run both during migration). Replace the startup
 *     `migrate(db, migrations)` with PowerSync's own schema management.
 */
import { wrapPowerSyncWithDrizzle } from '@powersync/drizzle-driver';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { createPowerSyncDatabase } from './factory';
import { drizzleSyncSchema } from './schema';
import { SupabaseConnector } from './connector';

let powerSync: AbstractPowerSyncDatabase | null = null;
let connector: SupabaseConnector | null = null;

/** The PowerSync database (lazy). */
export function getPowerSync(): AbstractPowerSyncDatabase {
  if (!powerSync) powerSync = createPowerSyncDatabase();
  return powerSync;
}

/** Drizzle instance backed by PowerSync — the repos would use this once wired. */
export function getSyncDb() {
  return wrapPowerSyncWithDrizzle(getPowerSync(), { schema: drizzleSyncSchema });
}

/** Start syncing (call when a Supabase session exists). */
export async function connectSync(): Promise<void> {
  if (!connector) connector = new SupabaseConnector();
  await getPowerSync().connect(connector);
}

/** Stop syncing (e.g. on sign-out). */
export async function disconnectSync(): Promise<void> {
  if (powerSync) await powerSync.disconnect();
}
