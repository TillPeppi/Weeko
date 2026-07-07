import { asc, desc, eq, gte } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { bodyMeasurement, type BodyMeasurement } from '../schema';
import { subDays } from 'date-fns';

/** All values a user can record for one day; only `weightKg` is required. */
export interface MeasurementInput {
  weightKg: number;
  fatPercent?: number | null;
  muscleMassKg?: number | null;
  boneMassKg?: number | null;
  bmrKcal?: number | null;
}

function normalize(input: MeasurementInput) {
  return {
    weightKg: input.weightKg,
    fatPercent: input.fatPercent ?? null,
    muscleMassKg: input.muscleMassKg ?? null,
    boneMassKg: input.boneMassKg ?? null,
    bmrKcal: input.bmrKcal ?? null,
  };
}

export async function addMeasurement(
  date: string,
  input: MeasurementInput
): Promise<BodyMeasurement> {
  const rows = await db
    .insert(bodyMeasurement)
    .values({
      id: newId(),
      date,
      ...normalize(input),
      createdAt: nowIso(),
      ...auditInsert(),
    })
    .returning();
  return rows[0];
}

export async function getMeasurement(date: string): Promise<BodyMeasurement | undefined> {
  const rows = await db.select().from(bodyMeasurement).where(eq(bodyMeasurement.date, date));
  return rows[0];
}

export async function updateMeasurement(date: string, input: MeasurementInput): Promise<void> {
  await db.update(bodyMeasurement).set(normalize(input)).where(eq(bodyMeasurement.date, date));
}

/** One measurement per day: update the existing row for `date` or insert a new one. */
export async function upsertMeasurement(
  date: string,
  input: MeasurementInput
): Promise<BodyMeasurement> {
  const existing = await getMeasurement(date);
  if (existing) {
    await updateMeasurement(date, input);
    return { ...existing, ...normalize(input) };
  }
  return addMeasurement(date, input);
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
