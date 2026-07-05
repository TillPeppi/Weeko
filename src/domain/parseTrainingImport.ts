/**
 * Entry point for the training import screen: raw JSON text in, either
 * validated sessions or structured, localizable errors out (mirrors
 * parseWeekImport). Issue locations are 1-based: "Session 2, Übung 1, Satz 3".
 */
import type { z } from 'zod';
import { trainingImportSchema, type TrainingImportParsed } from '@/schemas/trainingImport';

export interface TrainingImportIssue {
  /** i18n key, e.g. "training.import.errors.invalidReps" */
  key: string;
  /** 1-based session number */
  session?: number;
  /** 1-based exercise number within the session */
  exercise?: number;
  /** 1-based set number within the exercise */
  set?: number;
  /** offending field name, e.g. "weightKg" */
  field?: string;
  /** raw path for debugging */
  path: string;
}

export type ParseTrainingResult =
  | { ok: true; data: TrainingImportParsed }
  | { ok: false; errors: TrainingImportIssue[] };

const KNOWN_PREFIX = 'training.import.errors.';

function fallbackKey(code: string): string {
  switch (code) {
    case 'invalid_type':
      return `${KNOWN_PREFIX}missingOrWrongType`;
    case 'invalid_value':
      return `${KNOWN_PREFIX}invalidValue`;
    case 'unrecognized_keys':
      return `${KNOWN_PREFIX}unknownField`;
    default:
      return `${KNOWN_PREFIX}generic`;
  }
}

export function mapTrainingImportIssues(error: z.ZodError): TrainingImportIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String);
    const key = issue.message.startsWith(KNOWN_PREFIX) ? issue.message : fallbackKey(issue.code);
    const result: TrainingImportIssue = { key, path: path.join('.') };

    if (path[0] === 'sessions' && path.length > 1) {
      result.session = Number(path[1]) + 1;
      if (path[2] === 'exercises' && path.length > 3) {
        result.exercise = Number(path[3]) + 1;
        if (path[4] === 'sets' && path.length > 5) {
          result.set = Number(path[5]) + 1;
          if (path.length > 6) result.field = path[path.length - 1];
        } else if (path.length > 4) {
          result.field = path[path.length - 1];
        }
      } else if (path.length > 2) {
        result.field = path[path.length - 1];
      }
    } else if (path.length > 0) {
      result.field = path[path.length - 1];
    }

    return result;
  });
}

export function parseTrainingImport(jsonText: string): ParseTrainingResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, errors: [{ key: 'training.import.errors.invalidJson', path: '' }] };
  }

  const result = trainingImportSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: mapTrainingImportIssues(result.error) };
  }
  return { ok: true, data: result.data };
}

/**
 * Display label for an imported exercise: name, with equipment appended after a
 * middot when present. Shared by the preview UI and the import repo so the
 * "will be created" hints and badges stay consistent.
 */
export function importExerciseLabel(name: string, equipment?: string): string {
  const trimmedName = name.trim();
  const trimmedEquipment = equipment?.trim();
  return trimmedEquipment ? `${trimmedName} · ${trimmedEquipment}` : trimmedName;
}

/**
 * JSON example embedded in the copyable AI prompt (kept in code, not i18n:
 * the format block is technical and identical in every language).
 */
export const TRAINING_IMPORT_EXAMPLE = `{
  "schemaVersion": 1,
  "sessions": [
    {
      "date": "2026-07-05",
      "start": "18:30",
      "durationMinutes": 60,
      "title": "Push Day",
      "exercises": [
        {
          "name": "Beinbeuger einbeinig",
          "equipment": "Kabel",
          "sets": [
            { "reps": 10, "weightKg": 10 },
            { "reps": 8, "weightKg": 15 }
          ]
        },
        {
          "name": "Liegestütze",
          "sets": [ { "reps": 15 }, { "reps": 12 } ]
        },
        {
          "name": "Fahrradfahren",
          "sets": []
        }
      ]
    }
  ]
}`;
