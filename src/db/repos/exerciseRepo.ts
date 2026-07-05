import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { equipment, exercise, type Equipment, type Exercise } from '../schema';
import type { ExerciseSeed } from '../seeds';

export async function listEquipment(): Promise<Equipment[]> {
  return db.select().from(equipment).orderBy(asc(equipment.name));
}

export async function listExercises(): Promise<Exercise[]> {
  return db.select().from(exercise).orderBy(asc(exercise.name));
}

export async function createEquipment(name: string): Promise<void> {
  await db.insert(equipment).values({ id: newId(), name, available: true, ...auditInsert() });
}

export async function setEquipmentAvailable(id: string, available: boolean): Promise<void> {
  await db.update(equipment).set({ available }).where(eq(equipment.id, id));
}

export async function deleteEquipment(id: string): Promise<void> {
  await db.delete(equipment).where(eq(equipment.id, id));
}

export async function createExercise(values: {
  name: string;
  equipmentId?: string | null;
  isWeighted?: boolean;
}): Promise<void> {
  await db.insert(exercise).values({
    id: newId(),
    name: values.name,
    equipmentId: values.equipmentId ?? null,
    isWeighted: values.isWeighted ?? false,
    ...auditInsert(),
  });
}

export async function updateExercise(
  id: string,
  values: Partial<Pick<Exercise, 'name' | 'equipmentId' | 'isWeighted' | 'notes'>>
): Promise<void> {
  await db.update(exercise).set(values).where(eq(exercise.id, id));
}

export async function deleteExercise(id: string): Promise<void> {
  await db.delete(exercise).where(eq(exercise.id, id));
}

/** Seeds equipment + exercises together (onboarding). Skips if already present. */
export async function seedEquipmentAndExercises(
  equipmentSeeds: { name: string; available: boolean }[],
  exerciseSeeds: ExerciseSeed[]
): Promise<void> {
  const existing = await listExercises();
  if (existing.length > 0) return;
  await db.transaction(async (tx) => {
    const equipmentIds: string[] = [];
    for (const seed of equipmentSeeds) {
      const id = newId();
      await tx.insert(equipment).values({ ...seed, id, ...auditInsert() });
      equipmentIds.push(id);
    }
    for (const seed of exerciseSeeds) {
      await tx.insert(exercise).values({
        id: newId(),
        name: seed.name,
        equipmentId: seed.equipmentIndex === null ? null : equipmentIds[seed.equipmentIndex],
        isWeighted: seed.isWeighted,
        slug: seed.slug,
        muscleGroup: seed.muscleGroup,
        ...auditInsert(),
      });
    }
  });
}

/**
 * One-time catalog upgrade for installs seeded before slugs existed: backfills
 * slug/muscleGroup on rows whose name matches a default (any locale) and
 * inserts the defaults that are still missing. Runs only while NO row carries
 * a slug yet, so later user deletions of catalog exercises stick.
 */
export async function upgradeExerciseCatalog(
  exerciseSeeds: ExerciseSeed[],
  /** slug → seed names across locales (legacy rows kept their seed-time language) */
  namesBySlug: Record<string, string[]>,
  /** equipmentIndex → default equipment names across locales */
  equipmentNamesByIndex: string[][]
): Promise<void> {
  const existing = await listExercises();
  if (existing.length === 0 || existing.some((e) => e.slug !== null)) return;

  const equipmentRows = await listEquipment();
  const equipmentIdForIndex = (index: number | null): string | null => {
    if (index === null) return null;
    const names = equipmentNamesByIndex[index] ?? [];
    return equipmentRows.find((row) => names.includes(row.name))?.id ?? null;
  };

  for (const seed of exerciseSeeds) {
    const names = namesBySlug[seed.slug] ?? [seed.name];
    const legacy = existing.find((e) => e.slug === null && names.includes(e.name));
    if (legacy) {
      await db
        .update(exercise)
        .set({ slug: seed.slug, muscleGroup: seed.muscleGroup })
        .where(eq(exercise.id, legacy.id));
    } else {
      await db.insert(exercise).values({
        id: newId(),
        name: seed.name,
        equipmentId: equipmentIdForIndex(seed.equipmentIndex),
        isWeighted: seed.isWeighted,
        slug: seed.slug,
        muscleGroup: seed.muscleGroup,
        ...auditInsert(),
      });
    }
  }
}
