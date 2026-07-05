/**
 * Single entry point used by the import screen: raw JSON text in,
 * either a validated week + rule warnings or structured errors out.
 */
import { weekImportSchema, type WeekImportParsed } from '@/schemas/week';
import { mapImportIssues, type ImportIssue } from './importErrors';
import { checkWeekRules, type RuleWarning } from './rules';

export type ParseWeekResult =
  | { ok: true; week: WeekImportParsed; warnings: RuleWarning[] }
  | { ok: false; errors: ImportIssue[] };

export function parseWeekImport(jsonText: string): ParseWeekResult {
  let raw: unknown;
  try {
    raw = JSON.parse(jsonText);
  } catch {
    return { ok: false, errors: [{ key: 'week.import.errors.invalidJson', path: '' }] };
  }

  const result = weekImportSchema.safeParse(raw);
  if (!result.success) {
    return { ok: false, errors: mapImportIssues(result.error) };
  }

  return { ok: true, week: result.data, warnings: checkWeekRules(result.data) };
}
