import '../global.css';
import '@/i18n';
import { useCallback, useEffect, useState } from 'react';
import { Text, View } from 'react-native';
import { Stack, useRouter, useSegments } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as SplashScreen from 'expo-splash-screen';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { migrate } from 'drizzle-orm/expo-sqlite/migrator';
import { db, initDb } from '@/db/client';
import migrations from '@/db/migrations/migrations';
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
  const [initError, setInitError] = useState<Error | null>(null);
  const segments = useSegments();
  const router = useRouter();

  const hideNativeSplash = useCallback(() => {
    void SplashScreen.hideAsync();
  }, []);

  useEffect(() => {
    void (async () => {
      try {
        await initDb();
        await migrate(db, migrations);
        await bootstrapDefaults();
        await useSettingsStore.getState().hydrate();
        await useTrainingStore.getState().hydrate();
        await useAuthStore.getState().hydrate();
        setReady(true);
      } catch (error) {
        setInitError(error as Error);
      }
    })();
  }, []);

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

  if (!ready || !hydrated) {
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
          <Stack.Screen name="export" />
          <Stack.Screen name="session/[id]" />
        </Stack>
      </View>
    </GestureHandlerRootView>
  );
}
