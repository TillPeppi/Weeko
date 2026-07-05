import { asc, desc, eq, gte } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { bodyMeasurement, type BodyMeasurement } from '../schema';
import { subDays } from 'date-fns';

export async function addMeasurement(
  date: string,
  weightKg: number,
  fatPercent?: number
): Promise<BodyMeasurement> {
  const rows = await db
    .insert(bodyMeasurement)
    .values({
      date,
      weightKg,
      fatPercent: fatPercent ?? null,
      createdAt: nowIso(),
    })
    .returning();
  return rows[0];
}

export async function getMeasurement(date: string): Promise<BodyMeasurement | undefined> {
  const rows = await db.select().from(bodyMeasurement).where(eq(bodyMeasurement.date, date));
  return rows[0];
}

export async function updateMeasurement(
  date: string,
  weightKg: number,
  fatPercent?: number
): Promise<void> {
  await db
    .update(bodyMeasurement)
    .set({ weightKg, fatPercent: fatPercent ?? null })
    .where(eq(bodyMeasurement.date, date));
}

export async function deleteMeasurement(date: string): Promise<void> {
  await db.delete(bodyMeasurement).where(eq(bodyMeasurement.date, date));
}

export async function listMeasurements(days = 90): Promise<BodyMeasurement[]> {
  const cutoff = subDays(new Date(), days).toISOString().split('T')[0];
  return db
    .select()
    .from(bodyMeasurement)
    .where(gte(bodyMeasurement.date, cutoff))
    .orderBy(asc(bodyMeasurement.date));
}

export async function latestMeasurement(): Promise<BodyMeasurement | undefined> {
  const rows = await db
    .select()
    .from(bodyMeasurement)
    .orderBy(desc(bodyMeasurement.date))
    .limit(1);
  return rows[0];
}

export async function measurementsSince(date: string): Promise<BodyMeasurement[]> {
  return db
    .select()
    .from(bodyMeasurement)
    .where(gte(bodyMeasurement.date, date))
    .orderBy(asc(bodyMeasurement.date));
}
