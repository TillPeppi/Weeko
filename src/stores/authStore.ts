/**
 * Authentication state (Supabase). Mirrors the session so the router gate can
 * redirect to /login when signed out. No-op when auth isn't configured
 * (`isAuthConfigured` false) — the app then runs local-only, as before.
 *
 * Data stays local until the PowerSync step; this store only manages identity.
 */
import { create } from 'zustand';
import type { Session } from '@supabase/supabase-js';
import { getSupabase, isAuthConfigured } from '@/auth/supabase';

interface AuthState {
  /** current session, or null when signed out / not configured */
  session: Session | null;
  /** false until the initial session lookup + subscription is set up */
  hydrated: boolean;
  hydrate: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

/** Maps Supabase auth errors to i18n keys the login screen can translate. */
function authErrorKey(message: string): string {
  const m = message.toLowerCase();
  if (m.includes('invalid login')) return 'auth.errors.invalidCredentials';
  if (m.includes('already registered') || m.includes('already been registered'))
    return 'auth.errors.emailTaken';
  if (m.includes('password')) return 'auth.errors.weakPassword';
  if (m.includes('email')) return 'auth.errors.invalidEmail';
  if (m.includes('network') || m.includes('fetch')) return 'auth.errors.network';
  return 'auth.errors.generic';
}

export const useAuthStore = create<AuthState>((set) => ({
  session: null,
  hydrated: false,

  hydrate: async () => {
    const sb = getSupabase();
    if (!isAuthConfigured || !sb) {
      set({ session: null, hydrated: true });
      return;
    }
    const { data } = await sb.auth.getSession();
    set({ session: data.session, hydrated: true });
    // Keep the store in sync with token refresh / sign-in / sign-out.
    sb.auth.onAuthStateChange((_event, session) => {
      set({ session });
    });
  },

  signIn: async (email, password) => {
    const sb = getSupabase();
    if (!sb) throw new Error('auth.errors.notConfigured');
    const { error } = await sb.auth.signInWithPassword({ email: email.trim(), password });
    if (error) throw new Error(authErrorKey(error.message));
  },

  signUp: async (email, password) => {
    const sb = getSupabase();
    if (!sb) throw new Error('auth.errors.notConfigured');
    const { error } = await sb.auth.signUp({ email: email.trim(), password });
    if (error) throw new Error(authErrorKey(error.message));
  },

  signOut: async () => {
    const sb = getSupabase();
    if (!sb) return;
    await sb.auth.signOut();
    set({ session: null });
  },
}));
