/**
 * Full-data export (JSON dump) and complete wipe — Settings §6.6.
 * Data never leaves the device unless the user explicitly exports.
 */
import { db, expoDb } from '../client';
import {
  block,
  coachDismissal,
  equipment,
  exercise,
  foodEntry,
  foodProduct,
  notificationPref,
  profile,
  sessionTemplate,
  setLog,
  task,
  week,
  weekTemplate,
  weeklyStructure,
  workoutSession,
} from '../schema';

export async function exportAllData(): Promise<string> {
  const dump = {
    exportedAt: new Date().toISOString(),
    app: 'weeko',
    version: 1,
    data: {
      profile: await db.select().from(profile),
      weeklyStructure: await db.select().from(weeklyStructure),
      equipment: await db.select().from(equipment),
      exercise: await db.select().from(exercise),
      week: await db.select().from(week),
      block: await db.select().from(block),
      task: await db.select().from(task),
      workoutSession: await db.select().from(workoutSession),
      setLog: await db.select().from(setLog),
      sessionTemplate: await db.select().from(sessionTemplate),
      weekTemplate: await db.select().from(weekTemplate),
      notificationPref: await db.select().from(notificationPref),
      foodProduct: await db.select().from(foodProduct),
      foodEntry: await db.select().from(foodEntry),
      coachDismissal: await db.select().from(coachDismissal),
    },
  };
  return JSON.stringify(dump, null, 2);
}

/** Deletes ALL user data (irreversible). Caller must confirm with the user. */
export async function deleteAllData(): Promise<void> {
  await db.transaction(async (tx) => {
    await tx.delete(coachDismissal);
    await tx.delete(foodEntry);
    await tx.delete(foodProduct);
    await tx.delete(setLog);
    await tx.delete(workoutSession);
    await tx.delete(task);
    await tx.delete(block);
    await tx.delete(week);
    await tx.delete(weekTemplate);
    await tx.delete(sessionTemplate);
    await tx.delete(exercise);
    await tx.delete(equipment);
    await tx.delete(weeklyStructure);
    await tx.delete(notificationPref);
    await tx.delete(profile);
  });
  // reclaim space; ignore failure (e.g. web backend without VACUUM support)
  try {
    await expoDb.execAsync('VACUUM');
  } catch {
    /* noop */
  }
}
