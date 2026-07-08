import { newId } from '../id';
import { deleteAllRows, insertRows, nowIso, selectRows } from '../sb';
import type { WeeklyStructureRow } from '../schema';
import type { WeekdayStructureSeed } from '../seeds';

export async function getWeeklyStructure(): Promise<WeeklyStructureRow[]> {
  const rows = await selectRows<WeeklyStructureRow>('weekly_structure');
  return rows.sort((a, b) => a.weekday - b.weekday);
}

/**
 * Replaces the full 7-row structure (onboarding + settings both save whole weeks).
 * No client transaction with PostgREST — clear then re-insert sequentially.
 */
export async function saveWeeklyStructure(rows: WeekdayStructureSeed[]): Promise<void> {
  await deleteAllRows('weekly_structure');
  await insertRows(
    'weekly_structure',
    rows.map((row) => ({ id: newId(), ...row, updatedAt: nowIso() }))
  );
}
