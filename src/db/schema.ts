/**
 * Drizzle schema — SQLite is the single source of truth (requirements §7.1).
 * Booleans: integer({ mode: 'boolean' }); JSON payloads: text({ mode: 'json' });
 * timestamps: ISO-8601 strings (UTC).
 */
import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import type { BlockStatus, BlockType, MuscleGroup } from '@/domain/types';
import type { Nutrients, NutritionGoalOverrides } from '@/domain/nutrition';

/**
 * Columns added to every synced table for cloud sync (docs/SYNC_CONCEPT.md).
 * `user_id` = owner (null while local-only / signed out); `updated_at` = last
 * write (last-write-wins). Both nullable and stamped by `auditInsert`/`touch`
 * (src/db/audit.ts). PowerSync uses them once sync is activated; until then they
 * are harmless extra columns. Factory (not a shared object) so each table gets
 * its own fresh column builders.
 */
const syncCols = () => ({
  userId: text('user_id'),
  updatedAt: text('updated_at'),
});

/** Single-row table (id = 1): body data, goal, language, theme. */
export const profile = sqliteTable('profile', {
  id: text('id').primaryKey(),
  userId: text('user_id'),
  heightCm: real('height_cm'),
  age: integer('age'),
  sex: text('sex', { enum: ['male', 'female', 'other'] }),
  weightKg: real('weight_kg'),
  /** e.g. 'lean_gain' — free key, evaluated in Phase 2 */
  goal: text('goal'),
  goalRateKgPerWeek: real('goal_rate_kg_per_week'),
  /** manual overrides for daily nutrition targets; null = derived from profile */
  nutritionGoals: text('nutrition_goals', { mode: 'json' }).$type<NutritionGoalOverrides>(),
  language: text('language', { enum: ['de', 'en'] }).notNull().default('de'),
  theme: text('theme', { enum: ['system', 'light', 'dark'] }).notNull().default('light'),
  onboardingDone: integer('onboarding_done', { mode: 'boolean' }).notNull().default(false),
  updatedAt: text('updated_at').notNull(),
});

export interface FixedBlockSeed {
  type: BlockType;
  start: string;
  end: string;
  /** i18n key or free text shown as title */
  titleKey: string;
}

/** One row per ISO weekday (1 = Monday … 7 = Sunday). */
export const weeklyStructure = sqliteTable('weekly_structure', {
  id: text('id').primaryKey(),
  weekday: integer('weekday').notNull(),
  workStart: text('work_start'),
  workEnd: text('work_end'),
  workLocation: text('work_location', { enum: ['office', 'home'] }),
  /** "Tag meist fertig um" */
  doneBy: text('done_by'),
  fixedBlocks: text('fixed_blocks', { mode: 'json' }).$type<FixedBlockSeed[]>().notNull().default([]),
  ...syncCols(),
});

export const equipment = sqliteTable('equipment', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  available: integer('available', { mode: 'boolean' }).notNull().default(true),
  ...syncCols(),
});

export const exercise = sqliteTable('exercise', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  equipmentId: text('equipment_id').references(() => equipment.id, { onDelete: 'set null' }),
  isWeighted: integer('is_weighted', { mode: 'boolean' }).notNull().default(false),
  notes: text('notes'),
  /** stable key for built-in exercises (pictogram lookup, top-up seeding); null = user-created */
  slug: text('slug'),
  muscleGroup: text('muscle_group').$type<MuscleGroup>(),
  ...syncCols(),
});

export const week = sqliteTable(
  'week',
  {
    id: text('id').primaryKey(),
    year: integer('year').notNull(),
    isoWeek: integer('iso_week').notNull(),
    status: text('status', { enum: ['planned', 'active', 'archived'] })
      .notNull()
      .default('planned'),
    source: text('source', { enum: ['imported', 'template', 'manual'] })
      .notNull()
      .default('manual'),
    createdAt: text('created_at').notNull(),
    ...syncCols(),
  },
  (t) => [uniqueIndex('week_year_iso_unique').on(t.year, t.isoWeek)]
);

export const block = sqliteTable('block', {
  id: text('id').primaryKey(),
  weekId: text('week_id')
    .notNull()
    .references(() => week.id, { onDelete: 'cascade' }),
  /** YYYY-MM-DD */
  date: text('date').notNull(),
  type: text('type').$type<BlockType>().notNull(),
  start: text('start').notNull(),
  end: text('end').notNull(),
  title: text('title').notNull(),
  details: text('details', { mode: 'json' }).$type<Record<string, unknown>>(),
  status: text('status').$type<BlockStatus>().notNull().default('planned'),
  ...syncCols(),
});

export const task = sqliteTable('task', {
  id: text('id').primaryKey(),
  title: text('title').notNull(),
  category: text('category').notNull(),
  estimatedMinutes: integer('estimated_minutes'),
  recurrence: text('recurrence', { enum: ['none', 'daily', 'weekly'] })
    .notNull()
    .default('none'),
  status: text('status', { enum: ['open', 'done'] }).notNull().default('open'),
  windowDay: text('window_day'),
  windowStart: text('window_start'),
  windowEnd: text('window_end'),
  /** Reserved for Phase 3 (location context) — stored, ignored in Phase 1. */
  context: text('context', { mode: 'json' }).$type<Record<string, unknown>>(),
  blockId: text('block_id').references(() => block.id, { onDelete: 'set null' }),
  weekId: text('week_id').references(() => week.id, { onDelete: 'set null' }),
  createdAt: text('created_at').notNull(),
  completedAt: text('completed_at'),
  ...syncCols(),
});

export interface SessionTemplateItem {
  exerciseName: string;
  targetSets: number;
  targetReps: number;
  targetWeightKg?: number;
}

export const sessionTemplate = sqliteTable('session_template', {
  id: text('id').primaryKey(),
  /** stable key referenced by imports: 'hyrox' | 'weighted-calisthenics' | 'upper-short' | custom */
  key: text('key').notNull().unique(),
  /** i18n key for built-ins, free text for user templates */
  nameKey: text('name_key').notNull(),
  items: text('items', { mode: 'json' }).$type<SessionTemplateItem[]>().notNull().default([]),
  ...syncCols(),
});

export const workoutSession = sqliteTable('workout_session', {
  id: text('id').primaryKey(),
  blockId: text('block_id').references(() => block.id, { onDelete: 'set null' }),
  templateId: text('template_id').references(() => sessionTemplate.id, {
    onDelete: 'set null',
  }),
  title: text('title').notNull(),
  startedAt: text('started_at').notNull(),
  endedAt: text('ended_at'),
  status: text('status', { enum: ['active', 'done', 'aborted'] })
    .notNull()
    .default('active'),
  ...syncCols(),
});

export const setLog = sqliteTable('set_log', {
  id: text('id').primaryKey(),
  sessionId: text('session_id')
    .notNull()
    .references(() => workoutSession.id, { onDelete: 'cascade' }),
  exerciseId: text('exercise_id')
    .notNull()
    .references(() => exercise.id, { onDelete: 'cascade' }),
  setIndex: integer('set_index').notNull(),
  reps: integer('reps'),
  /** added weight for weighted calisthenics, total weight otherwise */
  weightKg: real('weight_kg'),
  done: integer('done', { mode: 'boolean' }).notNull().default(false),
  /**
   * Superset grouping within a session: all sets of exercises sharing the same
   * non-null value form one superset (rest only after the last exercise of the
   * group). null = standalone exercise. Group ids are unique per session.
   */
  supersetGroup: integer('superset_group'),
  createdAt: text('created_at').notNull(),
  ...syncCols(),
});

export const weekTemplate = sqliteTable('week_template', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  /** stored in the same shape as the import JSON (WeekImport, without week/dates) */
  data: text('data', { mode: 'json' }).$type<Record<string, unknown>>().notNull(),
  createdAt: text('created_at').notNull(),
  ...syncCols(),
});

/**
 * Cached food products (food tracker §Essenstracker), keyed by barcode.
 * `nutrients` holds per-100 g values; scanned OFF products stay available
 * offline once fetched.
 */
export const foodProduct = sqliteTable('food_product', {
  id: text('id').primaryKey(),
  barcode: text('barcode').notNull(),
  name: text('name').notNull(),
  brand: text('brand'),
  /** package size as text, e.g. "500 g" */
  quantity: text('quantity'),
  packageG: real('package_g'),
  servingG: real('serving_g'),
  nutrients: text('nutrients', { mode: 'json' }).$type<Nutrients>().notNull(),
  nutriScore: text('nutri_score'),
  source: text('source', { enum: ['off', 'custom'] })
    .notNull()
    .default('off'),
  favorite: integer('favorite', { mode: 'boolean' }).notNull().default(false),
  fetchedAt: text('fetched_at').notNull(),
});

/**
 * One logged food item. Name + per-100 g nutrients are snapshotted so history
 * stays stable even if the cached product is refreshed later.
 */
export const foodEntry = sqliteTable('food_entry', {
  id: text('id').primaryKey(),
  /** YYYY-MM-DD */
  date: text('date').notNull(),
  meal: text('meal', { enum: ['breakfast', 'lunch', 'dinner', 'snack'] })
    .notNull()
    .default('snack'),
  barcode: text('barcode'),
  name: text('name').notNull(),
  amountG: real('amount_g').notNull(),
  /** per 100 g snapshot */
  nutrients: text('nutrients', { mode: 'json' }).$type<Nutrients>().notNull(),
  createdAt: text('created_at').notNull(),
  ...syncCols(),
});

/**
 * Dismissed coach insights (domain/coach). `id` is the insight's stable id.
 * `until` null = dismissed permanently (until the underlying fact/id changes);
 * an ISO timestamp = snoozed, reappears once now passes it.
 */
export const coachDismissal = sqliteTable('coach_dismissal', {
  id: text('id').primaryKey(),
  until: text('until'),
  createdAt: text('created_at').notNull(),
  ...syncCols(),
});

export const notificationPref = sqliteTable('notification_pref', {
  id: text('id').primaryKey(),
  category: text('category').notNull(),
  enabled: integer('enabled', { mode: 'boolean' }).notNull().default(true),
  quietStart: text('quiet_start'),
  quietEnd: text('quiet_end'),
  escalationMinutes: integer('escalation_minutes').notNull().default(30),
  /** Coach digest only: HH:mm the morning push fires (null = default). */
  digestTime: text('digest_time'),
  /** Coach digest only: snooze window in minutes for dismissed warnings (null = default). */
  snoozeMinutes: integer('snooze_minutes'),
  ...syncCols(),
});

/** Body composition tracking: weight + body fat percentage */
export const bodyMeasurement = sqliteTable('body_measurement', {
  id: text('id').primaryKey(),
  /** YYYY-MM-DD */
  date: text('date').notNull(),
  /** weight in kg */
  weightKg: real('weight_kg').notNull(),
  /** optional body fat percentage (0–100) */
  fatPercent: real('fat_percent'),
  /** optional muscle mass in kg */
  muscleMassKg: real('muscle_mass_kg'),
  /** optional bone mass in kg */
  boneMassKg: real('bone_mass_kg'),
  /** optional basal metabolic rate (Grundumsatz) in kcal */
  bmrKcal: real('bmr_kcal'),
  createdAt: text('created_at').notNull(),
  ...syncCols(),
});

export type Profile = typeof profile.$inferSelect;
export type WeeklyStructureRow = typeof weeklyStructure.$inferSelect;
export type Equipment = typeof equipment.$inferSelect;
export type Exercise = typeof exercise.$inferSelect;
export type Week = typeof week.$inferSelect;
export type Block = typeof block.$inferSelect;
export type Task = typeof task.$inferSelect;
export type WorkoutSession = typeof workoutSession.$inferSelect;
export type SetLog = typeof setLog.$inferSelect;
export type SessionTemplate = typeof sessionTemplate.$inferSelect;
export type WeekTemplate = typeof weekTemplate.$inferSelect;
export type NotificationPref = typeof notificationPref.$inferSelect;
export type CoachDismissal = typeof coachDismissal.$inferSelect;
export type FoodProduct = typeof foodProduct.$inferSelect;
export type FoodEntry = typeof foodEntry.$inferSelect;
export type BodyMeasurement = typeof bodyMeasurement.$inferSelect;
