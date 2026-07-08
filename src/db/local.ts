/**
 * Device-local storage for data that isn't synced to the cloud: the Open-Food-
 * Facts product cache (`food_product`) and coach-dismissal UI state
 * (`coach_dismissal`). These were local-only under PowerSync too; with the
 * Supabase (online-only) data layer they live in AsyncStorage instead of a
 * local SQLite table. Small volumes, whole-blob read/write.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';

export async function loadLocal<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

export async function saveLocal(key: string, value: unknown): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}
