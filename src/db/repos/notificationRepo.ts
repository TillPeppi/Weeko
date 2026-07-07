import { asc, eq } from 'drizzle-orm';
import { db } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { notificationPref, type NotificationPref } from '../schema';
import { defaultNotificationPrefs } from '../seeds';

export async function listNotificationPrefs(): Promise<NotificationPref[]> {
  return db.select().from(notificationPref).orderBy(asc(notificationPref.category));
}

export async function getNotificationPref(category: string): Promise<NotificationPref | undefined> {
  const rows = await db
    .select()
    .from(notificationPref)
    .where(eq(notificationPref.category, category));
  return rows[0];
}

export async function upsertNotificationPref(
  category: string,
  values: Partial<Omit<NotificationPref, 'id' | 'category'>>
): Promise<void> {
  const existing = await getNotificationPref(category);
  if (existing) {
    await db.update(notificationPref).set(values).where(eq(notificationPref.category, category));
  } else {
    await db.insert(notificationPref).values({ id: newId(), category, ...values, ...auditInsert() });
  }
}

export async function seedNotificationPrefs(): Promise<void> {
  // Insert per category so categories added later (e.g. 'coach') also reach
  // databases seeded before they existed — existing prefs are left untouched.
  const existing = new Set((await listNotificationPrefs()).map((p) => p.category));
  for (const pref of defaultNotificationPrefs()) {
    if (existing.has(pref.category)) continue;
    await db.insert(notificationPref).values({ id: newId(), ...pref, ...auditInsert() });
  }
}
