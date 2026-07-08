import { newId } from '../id';
import { insertRow, insertRows, nowIso, sb, selectRows, toRow } from '../sb';
import { type Equipment, type Exercise } from '../schema';
import type { ExerciseSeed } from '../seeds';

export async function listEquipment(): Promise<Equipment[]> {
  return selectRows<Equipment>('equipment', (q) => q.order('name', { ascending: true }));
}

export async function listExercises(): Promise<Exercise[]> {
  return selectRows<Exercise>('exercise', (q) => q.order('name', { ascending: true }));
}

export async function createEquipment(name: string): Promise<void> {
  await insertRow('equipment', { id: newId(), name, available: true, updatedAt: nowIso() });
}

export async function setEquipmentAvailable(id: string, available: boolean): Promise<void> {
  const { error } = await sb()
    .from('equipment')
    .update(toRow({ available, updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteEquipment(id: string): Promise<void> {
  const { error } = await sb().from('equipment').delete().eq('id', id);
  if (error) throw error;
}

export async function createExercise(values: {
  name: string;
  equipmentId?: string | null;
  isWeighted?: boolean;
}): Promise<void> {
  await insertRow('exercise', {
    id: newId(),
    name: values.name,
    equipmentId: values.equipmentId ?? null,
    isWeighted: values.isWeighted ?? false,
    updatedAt: nowIso(),
  });
}

export async function updateExercise(
  id: string,
  values: Partial<Pick<Exercise, 'name' | 'equipmentId' | 'isWeighted' | 'notes'>>
): Promise<void> {
  const { error } = await sb()
    .from('exercise')
    .update(toRow({ ...values, updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteExercise(id: string): Promise<void> {
  const { error } = await sb().from('exercise').delete().eq('id', id);
  if (error) throw error;
}

/**
 * Seeds equipment + exercises together (onboarding). Skips if already present.
 * No client transaction with PostgREST — inserted sequentially.
 */
export async function seedEquipmentAndExercises(
  equipmentSeeds: { name: string; available: boolean }[],
  exerciseSeeds: ExerciseSeed[]
): Promise<void> {
  const existing = await listExercises();
  if (existing.length > 0) return;

  const equipmentIds: string[] = [];
  for (const seed of equipmentSeeds) {
    const id = newId();
    await insertRow('equipment', { ...seed, id, updatedAt: nowIso() });
    equipmentIds.push(id);
  }
  await insertRows(
    'exercise',
    exerciseSeeds.map((seed) => ({
      id: newId(),
      name: seed.name,
      equipmentId: seed.equipmentIndex === null ? null : equipmentIds[seed.equipmentIndex],
      isWeighted: seed.isWeighted,
      slug: seed.slug,
      muscleGroup: seed.muscleGroup,
      updatedAt: nowIso(),
    }))
  );
}

/**
 * One-time catalog upgrade for installs seeded before slugs existed: backfills
 * slug/muscleGroup on rows whose name matches a default (any locale) and
 * inserts the defaults that are still missing. Runs only while NO row carries
 * a slug yet, so later user deletions of catalog exercises stick.
 */
export async function upgradeExerciseCatalog(
  exerciseSeeds: ExerciseSeed[],
  namesBySlug: Record<string, string[]>,
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
      const { error } = await sb()
        .from('exercise')
        .update(toRow({ slug: seed.slug, muscleGroup: seed.muscleGroup, updatedAt: nowIso() }))
        .eq('id', legacy.id);
      if (error) throw error;
    } else {
      await insertRow('exercise', {
        id: newId(),
        name: seed.name,
        equipmentId: equipmentIdForIndex(seed.equipmentIndex),
        isWeighted: seed.isWeighted,
        slug: seed.slug,
        muscleGroup: seed.muscleGroup,
        updatedAt: nowIso(),
      });
    }
  }
}
