import { newId } from '../id';
import { fromRow, nowIso, sb, toRow } from '../sb';
import type { Profile } from '../schema';

/** Profile is a per-user singleton — RLS scopes it to the signed-in user. */
export async function getProfile(): Promise<Profile | undefined> {
  const { data, error } = await sb().from('profile').select('*').limit(1);
  if (error) throw error;
  return data && data[0] ? fromRow<Profile>(data[0]) : undefined;
}

export async function upsertProfile(
  values: Partial<Omit<Profile, 'id' | 'updatedAt'>>
): Promise<Profile> {
  const existing = await getProfile();
  if (existing) {
    const { error } = await sb()
      .from('profile')
      .update(toRow({ ...values, updatedAt: nowIso() }))
      .eq('id', existing.id);
    if (error) throw error;
  } else {
    const { error } = await sb()
      .from('profile')
      .insert(toRow({ id: newId(), ...values, updatedAt: nowIso() }));
    if (error) throw error;
  }
  return (await getProfile())!;
}
