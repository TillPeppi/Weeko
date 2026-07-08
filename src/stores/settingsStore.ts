/**
 * App settings (language, theme, onboarding state). Hydrated from SQLite at
 * startup; every change is persisted back and applied to i18next/NativeWind.
 */
import { Platform } from 'react-native';
import { create } from 'zustand';
import { colorScheme } from 'nativewind';
import { setAppLanguage, type AppLanguage } from '@/i18n';
import { getProfile, upsertProfile } from '@/db/repos/profileRepo';

export type ThemeSetting = 'system' | 'light' | 'dark';

interface SettingsState {
  hydrated: boolean;
  language: AppLanguage;
  theme: ThemeSetting;
  onboardingDone: boolean;
  hydrate: () => Promise<void>;
  setLanguage: (language: AppLanguage) => Promise<void>;
  setTheme: (theme: ThemeSetting) => Promise<void>;
  setOnboardingDone: (done: boolean) => Promise<void>;
}

function applyTheme(theme: ThemeSetting): void {
  colorScheme.set(theme);
  // tailwind darkMode is 'class' — on web NativeWind doesn't toggle the class
  // on <html> itself, so dark: variants would never fire without this
  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    const resolved =
      theme === 'system'
        ? window.matchMedia('(prefers-color-scheme: dark)').matches
          ? 'dark'
          : 'light'
        : theme;
    document.documentElement.classList.toggle('dark', resolved === 'dark');
  }
}

// keep the class in sync when the OS scheme changes while theme = system
if (Platform.OS === 'web' && typeof window !== 'undefined' && window.matchMedia) {
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
    const { theme } = useSettingsStore.getState();
    if (theme === 'system') applyTheme('system');
  });
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  hydrated: false,
  language: 'de',
  // Light paper is the primary mode ("Neo Brutal" direction); still user-overridable.
  theme: 'light',
  onboardingDone: false,

  hydrate: async () => {
    // Signed-out (or a transient Supabase error) must not block startup: fall
    // back to defaults so the login screen renders. Re-runs after login with a
    // session, when the real profile loads.
    let profile: Awaited<ReturnType<typeof getProfile>>;
    try {
      profile = await getProfile();
    } catch {
      profile = undefined;
    }
    const language = (profile?.language ?? get().language) as AppLanguage;
    const theme = (profile?.theme ?? 'light') as ThemeSetting;
    if (profile) {
      setAppLanguage(language);
    }
    applyTheme(theme);
    set({
      hydrated: true,
      language: profile ? language : get().language,
      theme,
      onboardingDone: profile?.onboardingDone ?? false,
    });
  },

  setLanguage: async (language) => {
    setAppLanguage(language);
    set({ language });
    await upsertProfile({ language });
  },

  setTheme: async (theme) => {
    applyTheme(theme);
    set({ theme });
    await upsertProfile({ theme });
  },

  setOnboardingDone: async (onboardingDone) => {
    // Local state first so the UI never blocks; cloud persist is best-effort.
    set({ onboardingDone });
    try {
      await upsertProfile({ onboardingDone });
    } catch (error) {
      console.error('[settings] onboardingDone konnte nicht gespeichert werden:', error);
    }
  },
}));
