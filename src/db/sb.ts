/**
 * Supabase data layer (online-only; replaces the former PowerSync local DB).
 *
 * The app talks to Supabase directly via PostgREST (supabase-js). Row ownership
 * and per-user filtering are enforced by RLS + `user_id default auth.uid()`, so
 * repos never set or filter `user_id` themselves. DB columns are snake_case;
 * the app's types are camelCase — `fromRow`/`toRow` bridge the two. Native
 * Postgres types (boolean, jsonb) mean values need no further coercion.
 */
import { getSupabase } from '@/auth/supabase';

/** The Supabase client; throws if the project isn't configured (shouldn't happen
 * behind the auth gate, but callers get a clear error instead of a null deref). */
export function sb() {
  const client = getSupabase();
  if (!client) throw new Error('Supabase ist nicht konfiguriert (EXPO_PUBLIC_SUPABASE_URL/ANON_KEY fehlen).');
  return client;
}

export function nowIso(): string {
  return new Date().toISOString();
}

const toCamel = (s: string): string => s.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase());
const toSnake = (s: string): string => s.replace(/[A-Z]/g, (c) => `_${c.toLowerCase()}`);

// JSON columns may come back as a parsed object (jsonb) or as a JSON string
// (text column) depending on how the table was created. Normalize to the parsed
// value so the app always gets objects/arrays. A non-JSON string (e.g. a title
// that happens to start with "[") fails to parse and is kept as-is.
function parseMaybeJson(value: unknown): unknown {
  if (typeof value !== 'string' || value.length < 2) return value;
  const first = value[0];
  if (first !== '{' && first !== '[') return value;
  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
}

/** DB row (snake_case) → app object (camelCase); parses JSON-string columns. */
export function fromRow<T>(row: Record<string, unknown>): T {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(row)) out[toCamel(k)] = parseMaybeJson(v);
  return out as T;
}

/** App object (camelCase) → DB row (snake_case). Drops `undefined` keys. */
export function toRow(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (v !== undefined) out[toSnake(k)] = v;
  }
  return out;
}

// A non-existent id, used to satisfy PostgREST's "delete/update needs a filter"
// guard when clearing a whole (RLS-scoped) table.
const NO_ID = '00000000-0000-0000-0000-000000000000';

/** SELECT * with an optional query refinement (order/filter/limit). */
export async function selectRows<T>(
  table: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  refine?: (q: any) => any
): Promise<T[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let query: any = sb().from(table).select('*');
  if (refine) query = refine(query) ?? query;
  const { data, error } = await query;
  if (error) throw error;
  return ((data as Record<string, unknown>[]) ?? []).map((r) => fromRow<T>(r));
}

/** Insert one row; returns the stored row. */
export async function insertRow<T>(table: string, obj: Record<string, unknown>): Promise<T> {
  const { data, error } = await sb().from(table).insert(toRow(obj)).select().single();
  if (error) throw error;
  return fromRow<T>(data as Record<string, unknown>);
}

/** Insert many rows in one request. */
export async function insertRows(table: string, objs: Record<string, unknown>[]): Promise<void> {
  if (objs.length === 0) return;
  const { error } = await sb()
    .from(table)
    .insert(objs.map((o) => toRow(o)));
  if (error) throw error;
}

/** Delete every (RLS-scoped) row of a table. */
export async function deleteAllRows(table: string): Promise<void> {
  const { error } = await sb().from(table).delete().neq('id', NO_ID);
  if (error) throw error;
}
