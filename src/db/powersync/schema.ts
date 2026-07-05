/**
 * PowerSync local schema — SCAFFOLD, not yet wired (docs/POWERSYNC_SETUP.md).
 *
 * Derived from the existing Drizzle tables via `DrizzleAppSchema`, so there's one
 * source of truth for the client schema. Only tables with a text `id` primary key
 * can be synced by PowerSync — the clean data tables below qualify.
 *
 * NOT included yet (finalize at activation):
 *  - `food_product` — local Open-Food-Facts cache, intentionally not synced.
 *  - `profile` (integer id=1), `weekly_structure` (keyed by weekday),
 *    `notification_pref` (keyed by category) — these lack a text `id` PK, so they
 *    need a text `id` column (or per-user modelling) before they can sync. The
 *    Postgres mirror + RLS for them already exists in supabase/schema.sql.
 */
import { DrizzleAppSchema } from '@powersync/drizzle-driver';
import {
  block,
  bodyMeasurement,
  coachDismissal,
  equipment,
  exercise,
  foodEntry,
  sessionTemplate,
  setLog,
  task,
  week,
  weekTemplate,
  workoutSession,
} from '../schema';

/** Drizzle tables that PowerSync syncs (text-id data tables). */
export const drizzleSyncSchema = {
  equipment,
  exercise,
  week,
  block,
  task,
  sessionTemplate,
  workoutSession,
  setLog,
  weekTemplate,
  foodEntry,
  bodyMeasurement,
  coachDismissal,
};

/** PowerSync local schema inferred from the Drizzle tables above. */
export const AppSchema = new DrizzleAppSchema(drizzleSyncSchema);
