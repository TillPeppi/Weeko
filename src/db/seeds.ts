/**
 * Onboarding seed/default data (requirements §5). These are PRE-FILLS only —
 * everything is editable in onboarding/settings, nothing here is used by logic.
 *
 * Display names are resolved through i18n at seed time (they become editable
 * user data afterwards), so seeds take a translate function.
 */
import type { FixedBlockSeed, SessionTemplateItem } from './schema';
import type { MuscleGroup } from '@/domain/types';

type Translate = (key: string) => string;

export interface WeekdayStructureSeed {
  weekday: number; // ISO: 1 = Monday … 7 = Sunday
  workStart: string | null;
  workEnd: string | null;
  workLocation: 'office' | 'home' | null;
  doneBy: string | null;
  fixedBlocks: FixedBlockSeed[];
}

export function defaultWeeklyStructure(): WeekdayStructureSeed[] {
  const dogEvening: FixedBlockSeed = {
    type: 'dog',
    start: '20:45',
    end: '21:00',
    titleKey: 'seeds.blocks.dogEvening',
  };
  const dogLunch: FixedBlockSeed = {
    type: 'dog',
    start: '13:00',
    end: '13:45',
    titleKey: 'seeds.blocks.dogLunch',
  };

  return [
    {
      weekday: 1,
      workStart: '07:30',
      workEnd: '17:00',
      workLocation: 'office',
      doneBy: '21:30',
      fixedBlocks: [
        { type: 'handball', start: '18:30', end: '20:30', titleKey: 'seeds.blocks.handball' },
        dogEvening,
      ],
    },
    {
      weekday: 2,
      workStart: '07:30',
      workEnd: '17:00',
      workLocation: 'office',
      doneBy: '22:30',
      fixedBlocks: [
        { type: 'handball', start: '19:30', end: '22:00', titleKey: 'seeds.blocks.handball' },
      ],
    },
    {
      weekday: 3,
      workStart: '07:30',
      workEnd: '17:00',
      workLocation: 'office',
      doneBy: '22:00',
      fixedBlocks: [
        { type: 'hobby', start: '19:00', end: '21:00', titleKey: 'seeds.blocks.trading' },
        dogEvening,
      ],
    },
    {
      weekday: 4,
      workStart: '07:30',
      workEnd: '17:00',
      workLocation: 'home',
      doneBy: '22:30',
      fixedBlocks: [
        dogLunch,
        { type: 'handball', start: '19:30', end: '22:00', titleKey: 'seeds.blocks.handball' },
      ],
    },
    {
      weekday: 5,
      workStart: '07:30',
      workEnd: '17:00',
      workLocation: 'home',
      doneBy: '22:00',
      fixedBlocks: [dogLunch, dogEvening],
    },
    { weekday: 6, workStart: null, workEnd: null, workLocation: null, doneBy: '23:00', fixedBlocks: [dogEvening] },
    { weekday: 7, workStart: null, workEnd: null, workLocation: null, doneBy: '21:30', fixedBlocks: [dogEvening] },
  ];
}

export const defaultProfileSeed = {
  weightKg: 73,
  goal: 'lean_gain',
  goalRateKgPerWeek: 0.375, // middle of 0.25–0.5 kg/week
};

export function defaultEquipment(t: Translate): { name: string; available: boolean }[] {
  return [
    { name: t('seeds.equipment.pullupBar'), available: true },
    { name: t('seeds.equipment.dipBars'), available: true },
    { name: t('seeds.equipment.heavyKettlebell'), available: true },
    { name: t('seeds.equipment.treadmill'), available: true },
  ];
}

export interface ExerciseSeed {
  /** stable key — also the pictogram lookup key (components/training/ExercisePictogram) */
  slug: string;
  name: string;
  equipmentIndex: number | null;
  isWeighted: boolean;
  muscleGroup: MuscleGroup;
}

/** equipmentIndex refers to defaultEquipment() order; null = bodyweight only. */
export function defaultExercises(t: Translate): ExerciseSeed[] {
  const ex = (
    slug: string,
    equipmentIndex: number | null,
    isWeighted: boolean,
    muscleGroup: MuscleGroup
  ): ExerciseSeed => ({ slug, name: t(`seeds.exercises.${slug}`), equipmentIndex, isWeighted, muscleGroup });

  return [
    // pull
    ex('pullup', 0, true, 'pull'),
    ex('chinup', 0, true, 'pull'),
    ex('kbRow', 2, true, 'pull'),
    // push
    ex('dip', 1, true, 'push'),
    ex('pushup', null, true, 'push'),
    ex('diamondPushup', null, false, 'push'),
    ex('pikePushup', null, false, 'push'),
    ex('kbPress', 2, true, 'push'),
    // legs
    ex('gobletSquat', 2, true, 'legs'),
    ex('kbLunge', 2, true, 'legs'),
    ex('kbDeadlift', 2, true, 'legs'),
    ex('bulgarianSplitSquat', null, true, 'legs'),
    ex('pistolSquat', null, true, 'legs'),
    ex('gluteBridge', null, true, 'legs'),
    ex('calfRaise', null, true, 'legs'),
    ex('wallSit', null, false, 'legs'),
    // core
    ex('plank', null, false, 'core'),
    ex('sidePlank', null, false, 'core'),
    ex('hollowHold', null, false, 'core'),
    ex('hangingLegRaise', 0, false, 'core'),
    ex('russianTwist', 2, true, 'core'),
    // cardio
    ex('treadmillRun', 3, false, 'cardio'),
    ex('burpee', null, false, 'cardio'),
    ex('mountainClimber', null, false, 'cardio'),
    ex('jumpSquat', null, false, 'cardio'),
    // full body
    ex('kbSwing', 2, true, 'fullBody'),
    ex('farmersCarry', 2, true, 'fullBody'),
  ];
}

export interface SessionTemplateSeed {
  key: string;
  nameKey: string;
  /** exercise names are matched against defaultExercises at seed time */
  items: SessionTemplateItem[];
}

export function defaultSessionTemplates(t: Translate): SessionTemplateSeed[] {
  return [
    {
      key: 'hyrox',
      nameKey: 'seeds.sessionTemplates.hyrox',
      items: [
        { exerciseName: t('seeds.exercises.treadmillRun'), targetSets: 4, targetReps: 1 },
        { exerciseName: t('seeds.exercises.kbSwing'), targetSets: 4, targetReps: 15 },
        { exerciseName: t('seeds.exercises.gobletSquat'), targetSets: 4, targetReps: 12 },
        { exerciseName: t('seeds.exercises.burpee'), targetSets: 4, targetReps: 10 },
        { exerciseName: t('seeds.exercises.farmersCarry'), targetSets: 4, targetReps: 1 },
      ],
    },
    {
      key: 'weighted-calisthenics',
      nameKey: 'seeds.sessionTemplates.weightedCalisthenics',
      items: [
        { exerciseName: t('seeds.exercises.pullup'), targetSets: 4, targetReps: 6 },
        { exerciseName: t('seeds.exercises.dip'), targetSets: 4, targetReps: 8 },
        { exerciseName: t('seeds.exercises.pushup'), targetSets: 3, targetReps: 12 },
        { exerciseName: t('seeds.exercises.kbLunge'), targetSets: 3, targetReps: 10 },
        { exerciseName: t('seeds.exercises.plank'), targetSets: 3, targetReps: 1 },
      ],
    },
    {
      key: 'upper-short',
      nameKey: 'seeds.sessionTemplates.upperShort',
      items: [
        { exerciseName: t('seeds.exercises.pullup'), targetSets: 3, targetReps: 6 },
        { exerciseName: t('seeds.exercises.pushup'), targetSets: 3, targetReps: 15 },
        { exerciseName: t('seeds.exercises.pikePushup'), targetSets: 2, targetReps: 10 },
      ],
    },
  ];
}

/** Task/notification categories known to Phase 1. */
export const TASK_CATEGORIES = ['mealprep', 'errands', 'guitar', 'household', 'other'] as const;
export type TaskCategory = (typeof TASK_CATEGORIES)[number];

/** Category used for block-start notifications (not a task category). */
export const BLOCK_START_CATEGORY = 'blockStart';

/** Category for the daily coach digest (a single morning insight push). */
export const COACH_CATEGORY = 'coach';

export function defaultNotificationPrefs(): {
  category: string;
  enabled: boolean;
  quietStart: string | null;
  quietEnd: string | null;
  escalationMinutes: number;
  digestTime: string | null;
  snoozeMinutes: number | null;
}[] {
  const base = {
    enabled: true,
    quietStart: '22:00',
    quietEnd: '08:00',
    escalationMinutes: 30,
    digestTime: null,
    snoozeMinutes: null,
  };
  return [
    { category: BLOCK_START_CATEGORY, ...base },
    ...TASK_CATEGORIES.map((category) => ({ category, ...base })),
    // Coach digest: fires at digestTime (no quiet window), snoozeMinutes = warning snooze.
    {
      category: COACH_CATEGORY,
      enabled: true,
      quietStart: null,
      quietEnd: null,
      escalationMinutes: 30,
      digestTime: '08:00',
      snoozeMinutes: 180,
    },
  ];
}
