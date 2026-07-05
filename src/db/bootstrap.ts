/**
 * Seeds default data on first start (idempotent — every seeder skips when its
 * table already has rows). Runs after migrations, before the UI mounts, so
 * onboarding only presents/edits these values instead of creating them.
 */
import i18n from '@/i18n';
import {
  defaultEquipment,
  defaultExercises,
  defaultSessionTemplates,
  defaultWeeklyStructure,
} from './seeds';
import { seedEquipmentAndExercises, upgradeExerciseCatalog } from './repos/exerciseRepo';
import { seedNotificationPrefs } from './repos/notificationRepo';
import { seedSessionTemplates } from './repos/trainingRepo';
import { getWeeklyStructure, saveWeeklyStructure } from './repos/structureRepo';

export async function bootstrapDefaults(): Promise<void> {
  const t = (key: string): string => i18n.t(key);

  await seedNotificationPrefs();
  await seedEquipmentAndExercises(defaultEquipment(t), defaultExercises(t));

  // Catalog upgrade for pre-slug installs: match legacy rows by their
  // seed-time name, which may be in either locale.
  const tDe = i18n.getFixedT('de');
  const tEn = i18n.getFixedT('en');
  const namesBySlug = Object.fromEntries(
    defaultExercises(tDe).map((seed, i) => [
      seed.slug,
      [seed.name, defaultExercises(tEn)[i].name],
    ])
  );
  const equipmentNamesByIndex = defaultEquipment(tDe).map((eq, i) => [
    eq.name,
    defaultEquipment(tEn)[i].name,
  ]);
  await upgradeExerciseCatalog(defaultExercises(t), namesBySlug, equipmentNamesByIndex);

  await seedSessionTemplates(defaultSessionTemplates(t));

  const structure = await getWeeklyStructure();
  if (structure.length === 0) {
    await saveWeeklyStructure(defaultWeeklyStructure());
  }
}
