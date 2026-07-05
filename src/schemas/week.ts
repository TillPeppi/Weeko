/**
 * Zod schema for the weekly plan JSON produced by the external planning AI.
 * Single source of truth for: import validation, TS types and the JSON schema
 * published in docs/WEEK_SCHEMA.md (via `z.toJSONSchema`, see scripts).
 *
 * Error messages are NOT human text — every issue carries an i18n key
 * (resolved in the UI via mapImportIssues + i18next).
 */
import { z } from 'zod';
import { BLOCK_TYPES } from '@/domain/types';
import {
  DAY_END_MIN,
  DAY_START_MIN,
  isValidIsoDate,
  isoWeekOf,
  TIME_RE,
  toMinutes,
} from '@/domain/time';

export const timeSchema = z
  .string()
  .regex(TIME_RE, { error: 'week.import.errors.invalidTime' })
  .meta({ description: 'Time of day as HH:mm (24h). 24:00 is allowed as end-of-day.' });

export const dateSchema = z
  .string()
  .refine(isValidIsoDate, { error: 'week.import.errors.invalidDate' })
  .meta({ description: 'Calendar date as YYYY-MM-DD.' });

export const blockTypeSchema = z.enum(BLOCK_TYPES, {
  error: 'week.import.errors.invalidBlockType',
});

export const blockSchema = z
  .object({
    type: blockTypeSchema,
    start: timeSchema,
    end: timeSchema,
    title: z
      .string({ error: 'week.import.errors.missingTitle' })
      .min(1, { error: 'week.import.errors.missingTitle' })
      .meta({ description: 'Display title. Any language — shown verbatim.' }),
    details: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        description:
          'Type-specific payload. training: { sessionTemplate?: string, intensity?: "low"|"medium"|"high" }. task: { taskCategory?: string }.',
      }),
  })
  .check((ctx) => {
    const { start, end } = ctx.value;
    if (!TIME_RE.test(start) || !TIME_RE.test(end)) return; // reported by field schema
    if (toMinutes(end) <= toMinutes(start)) {
      ctx.issues.push({
        code: 'custom',
        message: 'week.import.errors.endBeforeStart',
        path: ['end'],
        input: end,
      });
    }
    if (toMinutes(start) < DAY_START_MIN || toMinutes(end) > DAY_END_MIN) {
      ctx.issues.push({
        code: 'custom',
        message: 'week.import.errors.outsideDayBounds',
        path: ['start'],
        input: start,
      });
    }
  })
  .meta({ description: 'One scheduled block on a day timeline.' });

export const daySchema = z
  .object({
    date: dateSchema,
    blocks: z.array(blockSchema),
  })
  .meta({ description: 'One calendar day with its blocks.' });

export const importTaskSchema = z
  .object({
    title: z
      .string({ error: 'week.import.errors.missingTitle' })
      .min(1, { error: 'week.import.errors.missingTitle' }),
    category: z
      .string({ error: 'week.import.errors.missingCategory' })
      .min(1, { error: 'week.import.errors.missingCategory' })
      .meta({ description: 'Free-form category key, e.g. "mealprep", "errands", "guitar".' }),
    estimatedMinutes: z
      .number()
      .int()
      .positive({ error: 'week.import.errors.invalidEstimatedMinutes' })
      .optional(),
    preferredWindow: z
      .object({ day: dateSchema, start: timeSchema, end: timeSchema })
      .optional()
      .meta({ description: 'Optional preferred execution window.' }),
    context: z
      .record(z.string(), z.unknown())
      .optional()
      .meta({
        description: 'Reserved for Phase 3 (e.g. { "location": "home" }). Stored, ignored in Phase 1.',
      }),
  })
  .meta({ description: 'A task belonging to the week (not bound to a fixed time).' });

export const weekImportSchema = z
  .object({
    schemaVersion: z.literal(1, { error: 'week.import.errors.unsupportedVersion' }),
    week: z.object({
      year: z.number().int().min(2020).max(2100, { error: 'week.import.errors.invalidYear' }),
      isoWeek: z
        .number()
        .int()
        .min(1, { error: 'week.import.errors.invalidIsoWeek' })
        .max(53, { error: 'week.import.errors.invalidIsoWeek' }),
    }),
    days: z
      .array(daySchema)
      .min(1, { error: 'week.import.errors.noDays' })
      .max(7, { error: 'week.import.errors.tooManyDays' }),
    tasks: z.array(importTaskSchema).optional(),
  })
  .check((ctx) => {
    const { week, days } = ctx.value;
    if (!Array.isArray(days)) return;
    const seen = new Map<string, number>();
    days.forEach((day, index) => {
      if (!day?.date || !isValidIsoDate(day.date)) return;
      const firstIndex = seen.get(day.date);
      if (firstIndex !== undefined) {
        ctx.issues.push({
          code: 'custom',
          message: 'week.import.errors.duplicateDate',
          path: ['days', index, 'date'],
          input: day.date,
        });
      } else {
        seen.set(day.date, index);
      }
      const { year, isoWeek } = isoWeekOf(day.date);
      if (week && (year !== week.year || isoWeek !== week.isoWeek)) {
        ctx.issues.push({
          code: 'custom',
          message: 'week.import.errors.dateOutsideWeek',
          path: ['days', index, 'date'],
          input: day.date,
        });
      }
    });
  })
  .meta({
    id: 'WeekImport',
    description: 'Weekly plan for Weeko, produced by an external planning AI.',
  });

export type WeekImportParsed = z.infer<typeof weekImportSchema>;
