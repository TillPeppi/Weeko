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

let statusLogged = false;

/** Start syncing (call when a Supabase session exists + PowerSync is configured). */
export async function connectSync(): Promise<void> {
  if (!isPowerSyncConfigured) {
    console.warn('[sync] EXPO_PUBLIC_POWERSYNC_URL nicht gesetzt — Sync deaktiviert.');
    return;
  }
  if (!connector) connector = new SupabaseConnector();
  const ps = getPowerSync();
  // Diagnostic: surface connection + up/download errors that would otherwise be
  // invisible (the sync engine swallows them into SyncStatus).
  if (!statusLogged) {
    statusLogged = true;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ps.registerListener({
      statusChanged: (status: any) => {
        console.log('[sync] status', {
          connected: status?.connected,
          hasSynced: status?.hasSynced,
          lastSyncedAt: status?.lastSyncedAt,
          uploading: status?.dataFlowStatus?.uploading,
          downloading: status?.dataFlowStatus?.downloading,
          uploadError: status?.dataFlowStatus?.uploadError?.message,
          downloadError: status?.dataFlowStatus?.downloadError?.message,
        });
      },
    });
  }
  try {
    await ps.connect(connector);
    console.log('[sync] connect() gestartet (Endpoint aus EXPO_PUBLIC_POWERSYNC_URL).');
  } catch (error) {
    console.error('[sync] connect() fehlgeschlagen:', error);
    throw error;
  }
}

/** Stop syncing (e.g. on sign-out). */
export async function disconnectSync(): Promise<void> {
  if (powerSync) await powerSync.disconnect();
}
