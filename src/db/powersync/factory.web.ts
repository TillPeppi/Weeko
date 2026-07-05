/**
 * PowerSync database factory — WEB. SCAFFOLD, not yet wired.
 * Uses wa-sqlite/OPFS (same storage family as the current expo-sqlite web build);
 * still needs the COEP/COOP headers already set in metro.config.js.
 */
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { AppSchema } from './schema';

export function createPowerSyncDatabase(): AbstractPowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
      dbFilename: 'weeko.sync.db',
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
    }),
  });
}
