/**
 * Framework-free domain types shared across schemas, rule engine and UI.
 * No React/Expo imports allowed in src/domain.
 */

export const BLOCK_TYPES = [
  'work',
  'handball',
  'training',
  'dog',
  'meal',
  'hobby',
  'task',
  'free',
] as const;

export type BlockType = (typeof BLOCK_TYPES)[number];

export const BLOCK_STATUSES = ['planned', 'active', 'done', 'skipped'] as const;
export type BlockStatus = (typeof BLOCK_STATUSES)[number];

export const TRAINING_INTENSITIES = ['low', 'medium', 'high'] as const;
export type TrainingIntensity = (typeof TRAINING_INTENSITIES)[number];

/** Coarse grouping used to organize the exercise catalog in pickers. */
export const MUSCLE_GROUPS = ['pull', 'push', 'legs', 'core', 'cardio', 'fullBody'] as const;
export type MuscleGroup = (typeof MUSCLE_GROUPS)[number];

/** A block as it appears in the week import JSON (before persistence). */
export interface ImportBlock {
  type: BlockType;
  /** HH:mm, 05:00–24:00 */
  start: string;
  /** HH:mm, must be after start */
  end: string;
  title: string;
  details?: Record<string, unknown>;
}

export interface ImportDay {
  /** YYYY-MM-DD */
  date: string;
  blocks: ImportBlock[];
}

export interface ImportTask {
  title: string;
  category: string;
  estimatedMinutes?: number;
  preferredWindow?: { day: string; start: string; end: string };
  /** Reserved for Phase 3 (location context) — stored but ignored in Phase 1. */
  context?: Record<string, unknown>;
}

export interface WeekImport {
  schemaVersion: 1;
  week: { year: number; isoWeek: number };
  days: ImportDay[];
  tasks?: ImportTask[];
}

/** Structured, translatable message: UI renders t(key, params). */
export interface LocalizedMessage {
  key: string;
  params?: Record<string, string | number>;
}
