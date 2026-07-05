/**
 * Supabase client — accounts / auth (docs/SYNC_CONCEPT.md §6, docs/SUPABASE_SETUP.md).
 *
 * Phase 3 step 2+3: authentication only. Data is still 100 % local SQLite until
 * the PowerSync step wires actual cross-device sync.
 *
 * Config comes from `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY`.
 * The anon key is public by design (row-level security guards the data) — it is
 * meant to ship in the client, hence the `EXPO_PUBLIC_` prefix.
 *
 * When the env vars are absent the client is `null` and `isAuthConfigured` is
 * false: the app runs exactly as before (local-only, no login gate). This keeps
 * the app fully usable until a Supabase project is actually set up.
 */
import 'react-native-url-polyfill/auto';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const url = process.env.EXPO_PUBLIC_SUPABASE_URL;
const anonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

/** True once a Supabase project URL + anon key are configured. */
export const isAuthConfigured = Boolean(url && anonKey);

let client: SupabaseClient | null = null;

/**
 * Lazily creates (and caches) the Supabase client; null when auth isn't
 * configured. Lazy on purpose: `createClient` must NOT run during Expo's Node
 * static-render pass (`web.output: "static"`) — supabase-js errors on Node
 * without native WebSocket. Callers are the auth store's runtime methods, which
 * only execute in the browser/native, so the SSR pass never reaches this.
 */
export function getSupabase(): SupabaseClient | null {
  if (!isAuthConfigured) return null;
  if (!client) {
    client = createClient(url as string, anonKey as string, {
      auth: {
        // Web uses localStorage (default); native persists via AsyncStorage.
        storage: Platform.OS === 'web' ? undefined : AsyncStorage,
        autoRefreshToken: true,
        persistSession: true,
        // Email+password has no redirect callback — don't scan the URL for tokens.
        detectSessionInUrl: false,
      },
    });
  }
  return client;
}
