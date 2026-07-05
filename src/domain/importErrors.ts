/**
 * Maps ZodError issues to structured, localizable import errors.
 * Every issue our schema emits carries an i18n key as its message; anything
 * unexpected falls back to a generic key derived from the issue code.
 */
import type { z } from 'zod';

export interface ImportIssue {
  /** i18n key, e.g. "week.import.errors.endBeforeStart" */
  key: string;
  /** 1-based day number in the import (for "Tag 3, Block 2: …") */
  day?: number;
  /** 1-based block number within the day */
  block?: number;
  /** 1-based task number (for issues inside `tasks`) */
  task?: number;
  /** offending field name, e.g. "end" */
  field?: string;
  /** raw path for debugging */
  path: string;
}

const KNOWN_PREFIX = 'week.import.errors.';

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

export function mapImportIssues(error: z.ZodError): ImportIssue[] {
  return error.issues.map((issue) => {
    const path = issue.path.map(String);
    const key = issue.message.startsWith(KNOWN_PREFIX) ? issue.message : fallbackKey(issue.code);

    const result: ImportIssue = { key, path: path.join('.') };

    if (path[0] === 'days' && path.length > 1) {
      result.day = Number(path[1]) + 1;
      if (path[2] === 'blocks' && path.length > 3) {
        result.block = Number(path[3]) + 1;
        if (path.length > 4) result.field = path[path.length - 1];
      } else if (path.length > 2) {
        result.field = path[path.length - 1];
      }
    } else if (path[0] === 'tasks' && path.length > 1) {
      result.task = Number(path[1]) + 1;
      if (path.length > 2) result.field = path[path.length - 1];
    } else if (path.length > 0) {
      result.field = path[path.length - 1];
    }

    return result;
  });
}
