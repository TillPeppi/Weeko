/**
 * PowerSync database factory — NATIVE (iOS/Android). SCAFFOLD, not yet wired.
 * Metro picks `factory.web.ts` on web; tsc typechecks this default. Requires a
 * native dev build (`@powersync/react-native` is a native module).
 */
import { PowerSyncDatabase } from '@powersync/react-native';
import type { AbstractPowerSyncDatabase } from '@powersync/common';
import { AppSchema } from './schema';

export function createPowerSyncDatabase(): AbstractPowerSyncDatabase {
  return new PowerSyncDatabase({
    schema: AppSchema,
    database: { dbFilename: 'weeko.sync.db' },
  });
}
