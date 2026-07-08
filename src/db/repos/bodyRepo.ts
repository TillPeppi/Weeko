import { newId } from '../id';
import { fromRow, insertRow, nowIso, sb, selectRows, toRow } from '../sb';
import type { BodyMeasurement } from '../schema';
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
  return insertRow<BodyMeasurement>('body_measurement', {
    id: newId(),
    date,
    ...normalize(input),
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

export async function getMeasurement(date: string): Promise<BodyMeasurement | undefined> {
  const { data, error } = await sb().from('body_measurement').select('*').eq('date', date).limit(1);
  if (error) throw error;
  return data && data[0] ? fromRow<BodyMeasurement>(data[0]) : undefined;
}

export async function updateMeasurement(date: string, input: MeasurementInput): Promise<void> {
  const { error } = await sb()
    .from('body_measurement')
    .update(toRow({ ...normalize(input), updatedAt: nowIso() }))
    .eq('date', date);
  if (error) throw error;
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
  const { error } = await sb().from('body_measurement').delete().eq('date', date);
  if (error) throw error;
}

export async function listMeasurements(days = 90): Promise<BodyMeasurement[]> {
  const cutoff = subDays(new Date(), days).toISOString().split('T')[0];
  return selectRows<BodyMeasurement>('body_measurement', (q) =>
    q.gte('date', cutoff).order('date', { ascending: true })
  );
}

export async function latestMeasurement(): Promise<BodyMeasurement | undefined> {
  const { data, error } = await sb()
    .from('body_measurement')
    .select('*')
    .order('date', { ascending: false })
    .limit(1);
  if (error) throw error;
  return data && data[0] ? fromRow<BodyMeasurement>(data[0]) : undefined;
}

export async function measurementsSince(date: string): Promise<BodyMeasurement[]> {
  return selectRows<BodyMeasurement>('body_measurement', (q) =>
    q.gte('date', date).order('date', { ascending: true })
  );
}
