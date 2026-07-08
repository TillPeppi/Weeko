import { newId } from '../id';
import { fromRow, nowIso, sb, selectRows, toRow } from '../sb';
import type { NotificationPref } from '../schema';
import { defaultNotificationPrefs } from '../seeds';

export async function listNotificationPrefs(): Promise<NotificationPref[]> {
  return selectRows<NotificationPref>('notification_pref', (q) => q.order('category', { ascending: true }));
}

export async function getNotificationPref(category: string): Promise<NotificationPref | undefined> {
  const { data, error } = await sb()
    .from('notification_pref')
    .select('*')
    .eq('category', category)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? fromRow<NotificationPref>(data[0]) : undefined;
}

export async function upsertNotificationPref(
  category: string,
  values: Partial<Omit<NotificationPref, 'id' | 'category'>>
): Promise<void> {
  const existing = await getNotificationPref(category);
  if (existing) {
    const { error } = await sb()
      .from('notification_pref')
      .update(toRow({ ...values, updatedAt: nowIso() }))
      .eq('category', category);
    if (error) throw error;
  } else {
    const { error } = await sb()
      .from('notification_pref')
      .insert(toRow({ id: newId(), category, ...values, updatedAt: nowIso() }));
    if (error) throw error;
  }
}

export async function seedNotificationPrefs(): Promise<void> {
  // Insert per category so categories added later (e.g. 'coach') also reach
  // accounts seeded before they existed — existing prefs are left untouched.
  const existing = new Set((await listNotificationPrefs()).map((p) => p.category));
  const fresh = defaultNotificationPrefs().filter((pref) => !existing.has(pref.category));
  if (fresh.length === 0) return;
  const { error } = await sb()
    .from('notification_pref')
    .insert(fresh.map((pref) => toRow({ id: newId(), ...pref, updatedAt: nowIso() })));
  if (error) throw error;
}
