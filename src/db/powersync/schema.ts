/**
 * PowerSync local schema — derived from the Drizzle tables via `DrizzleAppSchema`
 * (one source of truth). PowerSync manages the local SQLite tables from this
 * schema (every table keyed by a text `id`), so the app's Drizzle migrations are
 * no longer applied locally once the swap is active.
 *
 * Synced tables: everything the user owns. `food_product` (Open-Food-Facts cache)
 * and `coach_dismissal` (per-device UI state; its id isn't unique across users)
 * are LOCAL-ONLY — present locally, never uploaded.
 */
import { DrizzleAppSchema, type DrizzleTableWithPowerSyncOptions } from '@powersync/drizzle-driver';
import {
  block,
  bodyMeasurement,
  coachDismissal,
  equipment,
  exercise,
  foodEntry,
  foodProduct,
  notificationPref,
  profile,
  sessionTemplate,
  setLog,
  task,
  week,
  weeklyStructure,
  weekTemplate,
  workoutSession,
} from '../schema';

const localOnly = (table: unknown): DrizzleTableWithPowerSyncOptions => ({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tableDefinition: table as any,
  options: { localOnly: true },
});

/** All Drizzle tables the repos query — passed to wrapPowerSyncWithDrizzle for typing. */
export const drizzleSyncSchema = {
  profile,
  weeklyStructure,
  notificationPref,
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
  foodProduct,
  coachDismissal,
};

/** PowerSync local schema: synced tables + local-only caches. */
export const AppSchema = new DrizzleAppSchema({
  profile,
  weeklyStructure,
  notificationPref,
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
  foodProduct: localOnly(foodProduct),
  coachDismissal: localOnly(coachDismissal),
});
