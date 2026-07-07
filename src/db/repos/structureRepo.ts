import { db } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { weeklyStructure, type WeeklyStructureRow } from '../schema';
import type { WeekdayStructureSeed } from '../seeds';

export async function getWeeklyStructure(): Promise<WeeklyStructureRow[]> {
  const rows = await db.select().from(weeklyStructure);
  return rows.sort((a, b) => a.weekday - b.weekday);
}

/** Replaces the full 7-row structure (onboarding + settings both save whole weeks). */
export async function saveWeeklyStructure(rows: WeekdayStructureSeed[]): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(weeklyStructure);
    for (const row of rows) {
      await tx.insert(weeklyStructure).values({ id: newId(), ...row, ...auditInsert() });
    }
  });
}
