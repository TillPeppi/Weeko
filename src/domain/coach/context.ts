/**
 * The coach context — one framework-free snapshot of everything the insight
 * rules need. Stores/repos assemble it from SQLite + HealthKit; the domain
 * rules never touch a database (mirrors the `*Like` shapes used elsewhere in
 * src/domain, e.g. FoodEntryLike / ExerciseSetRow).
 *
 * `now` is always injected (never Date.now() inside the domain) so the engine
 * stays deterministic and testable.
 */
import type { BlockStatus, BlockType } from '../types';
import type { TargetProfile } from '../nutrition';
import type { FoodEntryLike } from '../nutritionStats';
import type { ReadinessBaseline, ReadinessInput } from './readiness';

/** A planned block, reduced to what the rules care about. */
export interface BlockLike {
  type: BlockType;
  /** HH:mm */
  start: string;
  /** HH:mm */
  end: string;
  title: string;
  status: BlockStatus;
  details?: Record<string, unknown> | null;
}

/** A logged set from a finished session (matches trainingRepo.StatsSetRow). */
export interface TrainingSetLike {
  sessionId: string;
  exerciseId: string;
  /** YYYY-MM-DD of the session */
  date: string;
  reps: number | null;
  weightKg: number | null;
  done: boolean;
}

export interface CoachContext {
  /** current wall-clock time, injected by the caller */
  now: Date;
  /** today as YYYY-MM-DD (same clock as `now`) */
  today: string;
  profile: TargetProfile | null;
  /** today's blocks (any status) */
  todayBlocks: BlockLike[];
  /** recent food entries (per-100 g nutrients + amount), last ~2 weeks */
  nutritionEntries: FoodEntryLike[];
  /** distinct YYYY-MM-DD dates with a completed workout session */
  trainingDates: string[];
  /** logged sets from finished sessions (progression & load rules) */
  trainingSets: TrainingSetLike[];
  /** exercise id → display name (for progression insights) */
  exerciseNames: Record<string, string>;
  /** today's health signals from the HealthKit adapter */
  health: ReadinessInput;
  /** personal rolling baselines (optional; generic references otherwise) */
  readinessBaseline?: ReadinessBaseline;
}
