/**
 * PowerSync database factory — WEB (wa-sqlite/OPFS).
 *
 * Metro can't bundle PowerSync's `new Worker(new URL(...))` the way Vite/webpack
 * do, so we load the pre-built UMD worker + WASM copied to `public/@powersync/`
 * by `powersync-web copy-assets` (Expo serves `public/` at the web root). The
 * COEP/COOP headers in metro.config.js make the workers loadable.
 */
import { PowerSyncDatabase, WASQLiteOpenFactory, WASQLiteVFS } from '@powersync/web';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { AppSchema } from './schema';

const DB_WORKER = '/@powersync/worker/WASQLiteDB.umd.js';
const SYNC_WORKER = '/@powersync/worker/SharedSyncImplementation.umd.js';

export function createPowerSyncDatabase(): AbstractPowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: new WASQLiteOpenFactory({
      dbFilename: 'weeko.sync.db',
      vfs: WASQLiteVFS.OPFSCoopSyncVFS,
      worker: DB_WORKER,
      flags: { enableMultiTabs: false },
    }),
    sync: { worker: SYNC_WORKER },
    flags: { enableMultiTabs: false },
  });
}
