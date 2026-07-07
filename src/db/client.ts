/**
 * Database client — PowerSync is the local SQLite (docs/POWERSYNC_SETUP.md).
 * PowerSync manages the local schema from src/db/powersync/schema.ts (every table
 * keyed by text `id`); Drizzle queries go through the PowerSync driver. Works on
 * iOS/Android natively and on web via wa-sqlite/OPFS (needs the COEP/COOP headers
 * in metro.config.js + `powersync-web copy-assets`, see the setup doc).
 *
 * `db` is a lazy proxy: PowerSync is only opened on first actual query, never at
 * import time — so the web static-render pass (which imports repos but runs no
 * effects) doesn't try to open SQLite.
 */
import { getPowerSync, getSyncDb } from './powersync/system';

type Db = ReturnType<typeof getSyncDb>;

export const db = new Proxy({} as Db, {
  get(_, prop) {
    const target = getSyncDb() as unknown as Record<string | symbol, unknown>;
    const value = target[prop];
    return typeof value === 'function'
      ? (value as (...a: unknown[]) => unknown).bind(target)
      : value;
  },
});

/** Opens/initializes the PowerSync database. Awaited in the root layout. */
export async function initDb(): Promise<void> {
  await getPowerSync().init();
}

export function nowIso(): string {
  return new Date().toISOString();
}
