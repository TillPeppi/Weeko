import { Redirect, Tabs } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Apple, CalendarDays, Dumbbell, House, ListChecks, Scale } from 'lucide-react-native';
import { useSettingsStore } from '@/stores/settingsStore';

export default function TabsLayout() {
  const { t } = useTranslation();
  const onboardingDone = useSettingsStore((s) => s.onboardingDone);
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  if (!onboardingDone) {
    return <Redirect href="/onboarding" />;
  }

  return (
    <Tabs
      initialRouteName="index"
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: dark ? '#f1ecdf' : '#141519',
        tabBarInactiveTintColor: dark ? '#a49d8e' : '#6d6759',
        tabBarStyle: {
          backgroundColor: dark ? '#20222a' : '#fdfaf2',
          borderTopColor: dark ? '#e8e2d3' : '#141519',
          borderTopWidth: 2,
        },
      }}
    >
      <Tabs.Screen
        name="week"
        options={{
          title: t('tabs.week'),
          tabBarIcon: ({ color, size }) => <CalendarDays color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="index"
        options={{
          title: t('tabs.today'),
          tabBarIcon: ({ color, size }) => <House color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="training"
        options={{
          title: t('tabs.training'),
          tabBarIcon: ({ color, size }) => <Dumbbell color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="food"
        options={{
          title: t('tabs.food'),
          tabBarIcon: ({ color, size }) => <Apple color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="body"
        options={{
          title: t('tabs.body'),
          tabBarIcon: ({ color, size }) => <Scale color={color} size={size} />,
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: t('tabs.tasks'),
          tabBarIcon: ({ color, size }) => <ListChecks color={color} size={size} />,
        }}
      />
    </Tabs>
  );
}
