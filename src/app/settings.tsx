/**
 * Settings (§6.6): language, theme, notification prefs per category,
 * profile & weekly structure & exercises (same editors as onboarding),
 * JSON export and full data wipe.
 */
import { useCallback, useState } from 'react';
import { Platform, Pressable, Share, Switch, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { ChevronDown, ChevronRight, Download, Trash2, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TimeField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Body, Label, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { UI_COLORS, uiColor } from '@/constants/uiColors';
import { WeekStructureEditor } from '@/components/editors/WeekStructureEditor';
import { ProfileEditor, type ProfileDraft } from '@/components/editors/ProfileEditor';
import { EquipmentExerciseEditor } from '@/components/editors/EquipmentExerciseEditor';
import { useSettingsStore } from '@/stores/settingsStore';
import { getWeeklyStructure, saveWeeklyStructure } from '@/db/repos/structureRepo';
import { getProfile, upsertProfile } from '@/db/repos/profileRepo';
import { listNotificationPrefs, upsertNotificationPref } from '@/db/repos/notificationRepo';
import { exportAllData, deleteAllData } from '@/db/repos/dataRepo';
import { bootstrapDefaults } from '@/db/bootstrap';
import type { NotificationPref } from '@/db/schema';
import type { WeekdayStructureSeed } from '@/db/seeds';
import { defaultProfileSeed } from '@/db/seeds';
import type { NutritionGoalOverrides } from '@/domain/nutrition';

interface GoalsDraft {
  kcal: string;
  proteinMin: string;
  fiberMin: string;
  sugarsMax: string;
  saltMax: string;
}

const emptyGoals: GoalsDraft = { kcal: '', proteinMin: '', fiberMin: '', sugarsMax: '', saltMax: '' };

/** Quick-pick times for the coach morning digest. */
const DIGEST_PRESETS = [
  { key: 'morning', time: '08:00' },
  { key: 'noon', time: '12:00' },
  { key: 'evening', time: '20:00' },
] as const;

function goalsToOverrides(draft: GoalsDraft): NutritionGoalOverrides | null {
  const overrides: NutritionGoalOverrides = {};
  for (const key of Object.keys(draft) as (keyof GoalsDraft)[]) {
    const value = Number(draft[key].replace(',', '.'));
    if (draft[key].trim() && Number.isFinite(value) && value > 0) overrides[key] = value;
  }
  return Object.keys(overrides).length > 0 ? overrides : null;
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const settings = useSettingsStore();
  const [prefs, setPrefs] = useState<NotificationPref[]>([]);
  const [structure, setStructure] = useState<WeekdayStructureSeed[]>([]);
  const [profile, setProfile] = useState<ProfileDraft>({
    heightCm: '',
    age: '',
    sex: 'male',
    weightKg: '',
  });
  const [goals, setGoals] = useState<GoalsDraft>(emptyGoals);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [flash, setFlash] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setPrefs(await listNotificationPrefs());
    setStructure(await getWeeklyStructure());
    const existing = await getProfile();
    if (existing) {
      setProfile({
        heightCm: existing.heightCm ? String(existing.heightCm) : '',
        age: existing.age ? String(existing.age) : '',
        sex: existing.sex ?? 'male',
        weightKg: existing.weightKg ? String(existing.weightKg) : '',
      });
      const overrides = existing.nutritionGoals;
      setGoals({
        kcal: overrides?.kcal ? String(overrides.kcal) : '',
        proteinMin: overrides?.proteinMin ? String(overrides.proteinMin) : '',
        fiberMin: overrides?.fiberMin ? String(overrides.fiberMin) : '',
        sugarsMax: overrides?.sugarsMax ? String(overrides.sugarsMax) : '',
        saltMax: overrides?.saltMax ? String(overrides.saltMax) : '',
      });
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void refresh();
    }, [refresh])
  );

  const showFlash = (message: string) => {
    setFlash(message);
    setTimeout(() => setFlash(null), 2500);
  };

  const patchPref = async (category: string, patch: Partial<Omit<NotificationPref, 'category'>>) => {
    await upsertNotificationPref(category, patch);
    setPrefs(await listNotificationPrefs());
  };

  const exportData = async () => {
    const json = await exportAllData();
    if (Platform.OS === 'web') {
      const blob = new Blob([json], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `weeko-export-${new Date().toISOString().slice(0, 10)}.json`;
      a.click();
      URL.revokeObjectURL(url);
    } else {
      await Share.share({ message: json });
    }
    showFlash(t('settings.data.exportDone'));
  };

  const wipe = async () => {
    setConfirmDelete(false);
    await deleteAllData();
    await bootstrapDefaults();
    await settings.hydrate();
    showFlash(t('settings.data.deleted'));
    router.replace('/onboarding');
  };

  const toggleSection = (key: string) => setExpanded(expanded === key ? null : key);

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>{t('settings.title')}</Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          className="p-2 active:opacity-60"
        >
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      {flash && <Muted className="mt-2 text-success dark:text-success-dark">{flash}</Muted>}

      <Card className="mt-4">
        <Label>{t('settings.language.title')}</Label>
        <SegmentedControl
          options={[
            { value: 'de', label: t('settings.language.de') },
            { value: 'en', label: t('settings.language.en') },
          ]}
          value={settings.language}
          onChange={(language) => void settings.setLanguage(language)}
        />
        <Label className="mt-4">{t('settings.theme.title')}</Label>
        <SegmentedControl
          options={[
            { value: 'system', label: t('settings.theme.system') },
            { value: 'light', label: t('settings.theme.light') },
            { value: 'dark', label: t('settings.theme.dark') },
          ]}
          value={settings.theme}
          onChange={(theme) => void settings.setTheme(theme)}
        />
      </Card>

      <Card className="mt-4">
        <SectionTitle>{t('settings.notifications.title')}</SectionTitle>
        <Muted className="mt-1">{t('settings.notifications.subtitle')}</Muted>
        {Platform.OS === 'web' && (
          <Muted className="mt-2 text-warning dark:text-warning-dark">
            {t('settings.notifications.webUnsupported')}
          </Muted>
        )}
        <View className="mt-3 gap-4">
          {prefs.map((pref) => (
            <View
              key={pref.category}
              className="gap-2 border-t border-border dark:border-border-dark pt-3"
            >
              <View className="flex-row items-center justify-between">
                <Body className="font-semibold">
                  {pref.category === 'blockStart' || pref.category === 'coach'
                    ? t(`settings.notifications.categories.${pref.category}`)
                    : t(`tasks.categories.${pref.category}`, { defaultValue: pref.category })}
                </Body>
                <Switch
                  value={pref.enabled}
                  onValueChange={(enabled) => void patchPref(pref.category, { enabled })}
                />
              </View>
              {pref.enabled && pref.category === 'coach' && (
                <View className="gap-2">
                  <View className="flex-row flex-wrap gap-2">
                    {DIGEST_PRESETS.map((preset) => {
                      const active = pref.digestTime === preset.time;
                      return (
                        <Pressable
                          key={preset.time}
                          accessibilityRole="button"
                          accessibilityState={{ selected: active }}
                          onPress={() => void patchPref(pref.category, { digestTime: preset.time })}
                          className={`rounded-full border px-3 py-1.5 ${
                            active
                              ? 'border-accent bg-accent dark:border-accent-dark dark:bg-accent-dark'
                              : 'border-border dark:border-border-dark'
                          }`}
                        >
                          <Body
                            style={TABULAR}
                            className={`text-xs ${
                              active
                                ? 'font-semibold text-white'
                                : 'text-ink-muted dark:text-ink-muted-dark'
                            }`}
                          >
                            {t(`settings.notifications.digestPresets.${preset.key}`)} · {preset.time}
                          </Body>
                        </Pressable>
                      );
                    })}
                  </View>
                  <View className="flex-row items-end gap-3">
                    <TimeField
                      className="flex-1"
                      label={t('settings.notifications.digestTime')}
                      value={pref.digestTime ?? ''}
                      onChange={(v) => void patchPref(pref.category, { digestTime: v || null })}
                    />
                    <Field
                      className="flex-1"
                      style={TABULAR}
                      label={`${t('settings.notifications.snooze')} (${t('common.minutesShort')})`}
                      value={pref.snoozeMinutes !== null ? String(pref.snoozeMinutes) : ''}
                      onChangeText={(v) => {
                        const minutes = Number(v);
                        if (Number.isFinite(minutes) && minutes > 0) {
                          void patchPref(pref.category, { snoozeMinutes: minutes });
                        }
                      }}
                      keyboardType="numeric"
                      maxLength={4}
                    />
                  </View>
                </View>
              )}
              {pref.enabled && pref.category !== 'coach' && (
                <View className="flex-row items-end gap-3">
                  <TimeField
                    className="flex-1"
                    label={t('settings.notifications.quietFrom')}
                    value={pref.quietStart ?? ''}
                    onChange={(v) => void patchPref(pref.category, { quietStart: v || null })}
                  />
                  <TimeField
                    className="flex-1"
                    label={t('settings.notifications.quietTo')}
                    value={pref.quietEnd ?? ''}
                    onChange={(v) => void patchPref(pref.category, { quietEnd: v || null })}
                  />
                  <Field
                    className="flex-1"
                    style={TABULAR}
                    label={`${t('settings.notifications.escalation')} (${t('common.minutesShort')})`}
                    value={String(pref.escalationMinutes)}
                    onChangeText={(v) => {
                      const minutes = Number(v);
                      if (Number.isFinite(minutes) && minutes > 0) {
                        void patchPref(pref.category, { escalationMinutes: minutes });
                      }
                    }}
                    keyboardType="numeric"
                    maxLength={3}
                  />
                </View>
              )}
            </View>
          ))}
        </View>
      </Card>

      <CollapsibleCard
        title={t('settings.profileSection')}
        expanded={expanded === 'profile'}
        onToggle={() => toggleSection('profile')}
      >
        <ProfileEditor value={profile} onChange={setProfile} />
        <Button
          title={t('common.save')}
          onPress={async () => {
            await upsertProfile({
              heightCm: profile.heightCm ? Number(profile.heightCm) : null,
              age: profile.age ? Number(profile.age) : null,
              sex: profile.sex,
              weightKg: profile.weightKg ? Number(profile.weightKg.replace(',', '.')) : null,
              goal: defaultProfileSeed.goal,
              goalRateKgPerWeek: defaultProfileSeed.goalRateKgPerWeek,
            });
            showFlash(t('common.done'));
          }}
          className="mt-4 self-start"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={t('settings.nutrition.title')}
        expanded={expanded === 'nutrition'}
        onToggle={() => toggleSection('nutrition')}
      >
        <Muted>{t('settings.nutrition.hint')}</Muted>
        <View className="mt-3 gap-3">
          <View className="flex-row gap-3">
            <Field
              className="flex-1"
              style={TABULAR}
              label={t('settings.nutrition.kcal')}
              value={goals.kcal}
              onChangeText={(kcal) => setGoals({ ...goals, kcal })}
              keyboardType="numeric"
              maxLength={5}
            />
            <Field
              className="flex-1"
              style={TABULAR}
              label={t('settings.nutrition.protein')}
              value={goals.proteinMin}
              onChangeText={(proteinMin) => setGoals({ ...goals, proteinMin })}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
          <View className="flex-row gap-3">
            <Field
              className="flex-1"
              style={TABULAR}
              label={t('settings.nutrition.fiber')}
              value={goals.fiberMin}
              onChangeText={(fiberMin) => setGoals({ ...goals, fiberMin })}
              keyboardType="numeric"
              maxLength={4}
            />
            <Field
              className="flex-1"
              style={TABULAR}
              label={t('settings.nutrition.sugars')}
              value={goals.sugarsMax}
              onChangeText={(sugarsMax) => setGoals({ ...goals, sugarsMax })}
              keyboardType="numeric"
              maxLength={4}
            />
            <Field
              className="flex-1"
              style={TABULAR}
              label={t('settings.nutrition.salt')}
              value={goals.saltMax}
              onChangeText={(saltMax) => setGoals({ ...goals, saltMax })}
              keyboardType="numeric"
              maxLength={4}
            />
          </View>
        </View>
        <Button
          title={t('common.save')}
          onPress={async () => {
            await upsertProfile({ nutritionGoals: goalsToOverrides(goals) });
            showFlash(t('common.done'));
          }}
          className="mt-4 self-start"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={t('settings.structureSection')}
        expanded={expanded === 'structure'}
        onToggle={() => toggleSection('structure')}
      >
        <WeekStructureEditor value={structure} onChange={setStructure} />
        <Button
          title={t('common.save')}
          onPress={async () => {
            await saveWeeklyStructure(structure);
            showFlash(t('common.done'));
          }}
          className="mt-4 self-start"
        />
      </CollapsibleCard>

      <CollapsibleCard
        title={t('settings.exercisesSection')}
        expanded={expanded === 'exercises'}
        onToggle={() => toggleSection('exercises')}
      >
        <EquipmentExerciseEditor />
      </CollapsibleCard>

      <Card className="mt-4">
        <SectionTitle>{t('settings.data.title')}</SectionTitle>
        <View className="mt-3 gap-3">
          <Button
            title={t('settings.data.export')}
            variant="secondary"
            icon={<Download size={18} color={uiColor('muted', dark)} />}
            onPress={() => void exportData()}
          />
          <Button
            title={t('settings.data.deleteAll')}
            variant="danger"
            icon={<Trash2 size={18} color={UI_COLORS.ink.light} />}
            onPress={() => setConfirmDelete(true)}
          />
        </View>
      </Card>

      <Button
        title={t('settings.rerunOnboarding')}
        variant="ghost"
        onPress={() => {
          void settings.setOnboardingDone(false);
          router.replace('/onboarding');
        }}
        className="mt-4"
      />
      <Muted className="mt-2 mb-8 text-center">{t('settings.about')}</Muted>

      <ConfirmDialog
        visible={confirmDelete}
        title={t('settings.data.deleteConfirmTitle')}
        message={t('settings.data.deleteConfirmMessage')}
        confirmLabel={t('common.delete')}
        destructive
        onConfirm={() => void wipe()}
        onCancel={() => setConfirmDelete(false)}
      />
    </Screen>
  );
}

function CollapsibleCard({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  const { colorScheme } = useColorScheme();
  const chevronColor = uiColor('muted', colorScheme === 'dark');
  return (
    <Card className="mt-4">
      <Pressable
        accessibilityRole="button"
        onPress={onToggle}
        className="flex-row items-center justify-between active:opacity-70"
      >
        <SectionTitle>{title}</SectionTitle>
        {expanded ? (
          <ChevronDown size={20} color={chevronColor} />
        ) : (
          <ChevronRight size={20} color={chevronColor} />
        )}
      </Pressable>
      {expanded && <View className="mt-3">{children}</View>}
    </Card>
  );
}
