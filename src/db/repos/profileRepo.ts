import { eq } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { currentUserId } from '../audit';
import { profile, type Profile } from '../schema';

/** Profile is a per-user singleton — read the one row, keyed by its text id. */
export async function getProfile(): Promise<Profile | undefined> {
  const rows = await db.select().from(profile).limit(1);
  return rows[0];
}

export async function upsertProfile(
  values: Partial<Omit<Profile, 'id' | 'updatedAt'>>
): Promise<Profile> {
  const existing = await getProfile();
  if (existing) {
    await db
      .update(profile)
      .set({ ...values, updatedAt: nowIso() })
      .where(eq(profile.id, existing.id));
  } else {
    await db
      .insert(profile)
      .values({ id: newId(), userId: currentUserId(), ...values, updatedAt: nowIso() });
  }
  return (await getProfile())!;
}
