import '../global.css';
import '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { bootstrapDefaults } from '@/db/bootstrap';
import { SplashPulse } from '@/components/SplashPulse';
import { useSettingsStore } from '@/stores/settingsStore';
import { useTrainingStore } from '@/stores/trainingStore';
import { useAuthStore } from '@/stores/authStore';
import { isAuthConfigured } from '@/auth/supabase';
import { initNotifications } from '@/notifications/scheduler';

// Keep the native splash up until our animated one has painted, so the static
// mark blends into the pulse instead of flashing an empty screen.
void SplashScreen.preventAutoHideAsync();

initNotifications();

export default function RootLayout() {
  const hydrated = useSettingsStore((s) => s.hydrated);
  const session = useAuthStore((s) => s.session);
  const authHydrated = useAuthStore((s) => s.hydrated);
  const [ready, setReady] = useState(false);
  const [accountReady, setAccountReady] = useState(false);
  const [initError, setInitError] = useState<Error | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const hideNativeSplash = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  // Startup: no local DB to open anymore (data lives in Supabase). Just hydrate
  // auth + settings so the auth gate + theme are correct on the login screen.
  useEffect(() => {
    void (async () => {
      try {
        await useAuthStore.getState().hydrate();
        await useSettingsStore.getState().hydrate();
        setReady(true);
      } catch (error) {
        setInitError(error as Error);
      }
    })();
  }, []);

  // Per-account setup runs once a session exists: seed this account's defaults
  // (idempotent, RLS-scoped) then re-hydrate the account-scoped stores so
  // onboardingDone/theme/templates reflect the cloud data.
  useEffect(() => {
    if (!ready) return;
    if (!session) {
      setAccountReady(false);
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        await bootstrapDefaults();
        await useSettingsStore.getState().hydrate();
        await useTrainingStore.getState().hydrate();
      } catch (error) {
        console.error('[bootstrap] account setup failed:', error);
      } finally {
        if (!cancelled) setAccountReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, session]);

  // Auth gate: only active once a Supabase project is configured. Signed-out
  // users land on /login; signed-in users are pushed out of it. When auth is
  // not configured this is a no-op and the app runs local-only, as before.
  useEffect(() => {
    if (!ready || !authHydrated || !isAuthConfigured) return;
    const onLogin = segments[0] === 'login';
    if (!session && !onLogin) router.replace('/login');
    else if (session && onLogin) router.replace('/');
  }, [ready, authHydrated, session, segments, router]);

  if (initError) {
    // startup failure (e.g. storage unavailable) — technical, not translated
    return (
      <View className="flex-1 items-center justify-center bg-surface dark:bg-surface-dark p-6">
        <Text className="text-danger dark:text-danger-dark">{initError.message}</Text>
      </View>
    );
  }

  // While signed in, hold the splash until the account is set up + re-hydrated,
  // so returning users never flash the onboarding gate before onboardingDone loads.
  if (!ready || !hydrated || (session && !accountReady)) {
    return <SplashPulse onLayout={hideNativeSplash} />;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <StatusBar style="auto" />
      <View className="flex-1 bg-surface dark:bg-surface-dark">
        <Stack screenOptions={{ headerShown: false }}>
          <Stack.Screen name="(tabs)" />
          <Stack.Screen name="login" />
          <Stack.Screen name="onboarding/index" />
          <Stack.Screen name="import" options={{ presentation: 'modal' }} />
          <Stack.Screen name="training-import" options={{ presentation: 'modal' }} />
          <Stack.Screen name="food/add" options={{ presentation: 'modal' }} />
          <Stack.Screen name="settings" />
          <Stack.Screen name="stats" />
          <Stack.Screen name="body" />
          <Stack.Screen name="export" />
          <Stack.Screen name="session/[id]" />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
