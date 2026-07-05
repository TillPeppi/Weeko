/**
 * Zod schema for the training-log JSON produced by an external AI from a
 * free-text workout description (see the copyable prompt on the import
 * screen). Mirrors the week-import approach: every issue carries an i18n key
 * (training.import.errors.*), resolved in the UI.
 */
import { z } from 'zod';
import { isValidIsoDate, TIME_RE } from '@/domain/time';

const trainingTimeSchema = z
  .string()
  .regex(TIME_RE, { error: 'training.import.errors.invalidTime' })
  .meta({ description: 'Time of day as HH:mm (24h).' });

const trainingDateSchema = z
  .string()
  .refine(isValidIsoDate, { error: 'training.import.errors.invalidDate' })
  .meta({ description: 'Calendar date as YYYY-MM-DD.' });

export const importSetSchema = z
  .object({
    reps: z
      .number()
      .int({ error: 'training.import.errors.invalidReps' })
      .positive({ error: 'training.import.errors.invalidReps' })
      .optional(),
    weightKg: z
      .number()
      .nonnegative({ error: 'training.import.errors.invalidWeight' })
      .optional()
      .meta({ description: 'Added weight for weighted calisthenics, total weight otherwise.' }),
  })
  .meta({ description: 'One set. Bodyweight sets carry only reps.' });

export const importExerciseSchema = z
  .object({
    name: z
      .string({ error: 'training.import.errors.missingExerciseName' })
      .min(1, { error: 'training.import.errors.missingExerciseName' })
      .meta({ description: 'Exercise name WITHOUT equipment — matched case-insensitively, unknown names are created.' }),
    equipment: z
      .string()
      .optional()
      .meta({
        description:
          'Equipment used, e.g. "Kabel". Matched case-insensitively; unknown equipment is created. Omit if none.',
      }),
    sets: z
      .array(importSetSchema)
      .default([])
      .meta({
        description: 'Sets in performed order. Empty ([]) for cardio/mobility with no countable sets.',
      }),
  })
  .meta({ description: 'One exercise with its sets, in performed order.' });

export const importSessionSchema = z
  .object({
    date: trainingDateSchema,
    start: trainingTimeSchema.optional(),
    durationMinutes: z
      .number()
      .int({ error: 'training.import.errors.invalidDuration' })
      .positive({ error: 'training.import.errors.invalidDuration' })
      .optional(),
    title: z
      .string({ error: 'training.import.errors.missingTitle' })
      .min(1, { error: 'training.import.errors.missingTitle' }),
    exercises: z
      .array(importExerciseSchema)
      .min(1, { error: 'training.import.errors.noExercises' }),
  })
  .meta({ description: 'One completed workout session.' });

export const trainingImportSchema = z
  .object({
    schemaVersion: z.literal(1, { error: 'training.import.errors.unsupportedVersion' }),
    sessions: z
      .array(importSessionSchema)
      .min(1, { error: 'training.import.errors.noSessions' })
      .max(50, { error: 'training.import.errors.tooManySessions' }),
  })
  .meta({
    id: 'TrainingImport',
    description: 'Completed training sessions for Weeko, produced by an external AI.',
  });

export type TrainingImportParsed = z.infer<typeof trainingImportSchema>;
export type TrainingImportSession = TrainingImportParsed['sessions'][number];
