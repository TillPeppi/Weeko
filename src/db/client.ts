/**
 * SQLite via expo-sqlite + Drizzle. Works on iOS/Android natively and on web
 * through the wa-sqlite/OPFS wasm build (requires the COEP/COOP headers set in
 * metro.config.js — see docs/ARCHITECTURE.md).
 *
 * The database MUST be opened asynchronously on web: a synchronous top-level
 * open races against the SQLite worker becoming ready ("Sync operation
 * timeout"). The root layout awaits initDb() before rendering anything that
 * touches the DB; `db`/`expoDb` are proxies that throw when used earlier.
 */
import { drizzle, type ExpoSQLiteDatabase } from 'drizzle-orm/expo-sqlite';
import { openDatabaseAsync, openDatabaseSync, type SQLiteDatabase } from 'expo-sqlite';
import { Platform } from 'react-native';
import * as schema from './schema';

let rawDb: SQLiteDatabase | null = null;
let dbInstance: ExpoSQLiteDatabase<typeof schema> | null = null;

export async function initDb(): Promise<void> {
  if (dbInstance) return;
  rawDb =
    Platform.OS === 'web' ? await openDatabaseAsync('weeko.db') : openDatabaseSync('weeko.db');
  dbInstance = drizzle(rawDb, { schema });
}

function guard<T extends object>(instance: () => T | null, name: string): T {
  return new Proxy({} as T, {
    get(_, prop) {
      const target = instance();
      if (!target) throw new Error(`${name} not initialized — call initDb() first`);
      const value = Reflect.get(target, prop) as unknown;
      return typeof value === 'function' ? (value as (...a: unknown[]) => unknown).bind(target) : value;
    },
  });
}

export const db = guard<ExpoSQLiteDatabase<typeof schema>>(() => dbInstance, 'db');
export const expoDb = guard<SQLiteDatabase>(() => rawDb, 'expoDb');

export function nowIso(): string {
  return new Date().toISOString();
}
