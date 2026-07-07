/**
 * PowerSync database factory — NATIVE (iOS/Android). SCAFFOLD default; Metro picks
 * `factory.web.ts` on web. Uses OP-SQLite (`@powersync/op-sqlite`) as the SQLite
 * backend — the maintained replacement for the older quick-sqlite driver. Requires
 * a native dev build (`npx expo prebuild --clean && npx expo run:ios`).
 */
import { PowerSyncDatabase } from '@powersync/react-native';
import { OPSqliteOpenFactory } from '@powersync/op-sqlite';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { AppSchema } from './schema';

export function createPowerSyncDatabase(): AbstractPowerSyncDatabase {
  const factory = new OPSqliteOpenFactory({ dbFilename: 'weeko.sync.db' });
  return new PowerSyncDatabase({ schema: AppSchema, database: factory });
}
