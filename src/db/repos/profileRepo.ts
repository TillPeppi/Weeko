import { eq } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { profile, type Profile } from '../schema';

const PROFILE_ID = 1;

export async function getProfile(): Promise<Profile | undefined> {
  const rows = await db.select().from(profile).where(eq(profile.id, PROFILE_ID));
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
      .where(eq(profile.id, PROFILE_ID));
  } else {
    await db.insert(profile).values({ id: PROFILE_ID, ...values, updatedAt: nowIso() });
  }
  return (await getProfile())!;
}
