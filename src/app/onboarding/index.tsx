/**
 * Multi-step, skippable onboarding (§6.1). Values from §5 arrive as seeded
 * defaults (bootstrap) — this flow presents and edits them.
 * Steps: welcome → weekly structure → body profile → equipment → prefs → done.
 */
import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Subtitle, Title } from '@/components/ui/Text';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Label } from '@/components/ui/Text';
import { WeekStructureEditor } from '@/components/editors/WeekStructureEditor';
import { ProfileEditor, type ProfileDraft } from '@/components/editors/ProfileEditor';
import { EquipmentExerciseEditor } from '@/components/editors/EquipmentExerciseEditor';
import { getWeeklyStructure, saveWeeklyStructure } from '@/db/repos/structureRepo';
import { getProfile, upsertProfile } from '@/db/repos/profileRepo';
import { defaultProfileSeed, type WeekdayStructureSeed } from '@/db/seeds';
import { useSettingsStore } from '@/stores/settingsStore';

const STEPS = ['welcome', 'structure', 'profile', 'equipment', 'preferences', 'finish'] as const;
type Step = (typeof STEPS)[number];

export default function OnboardingScreen() {
  const { t } = useTranslation();
  const settings = useSettingsStore();
  const [step, setStep] = useState<Step>('welcome');
  const [structure, setStructure] = useState<WeekdayStructureSeed[]>([]);
  const [profile, setProfile] = useState<ProfileDraft>({
    heightCm: '',
    age: '',
    sex: 'male',
    weightKg: String(defaultProfileSeed.weightKg),
  });

  useEffect(() => {
    void (async () => {
      const rows = await getWeeklyStructure();
      setStructure(rows);
      const existing = await getProfile();
      if (existing) {
        setProfile({
          heightCm: existing.heightCm ? String(existing.heightCm) : '',
          age: existing.age ? String(existing.age) : '',
          sex: existing.sex ?? 'male',
          weightKg: existing.weightKg ? String(existing.weightKg) : String(defaultProfileSeed.weightKg),
        });
      }
    })();
  }, []);

  const stepIndex = STEPS.indexOf(step);

  const persistStructure = async () => {
    await saveWeeklyStructure(structure);
  };

  const persistProfile = async () => {
    await upsertProfile({
      heightCm: profile.heightCm ? Number(profile.heightCm) : null,
      age: profile.age ? Number(profile.age) : null,
      sex: profile.sex,
      weightKg: profile.weightKg ? Number(profile.weightKg.replace(',', '.')) : null,
      goal: defaultProfileSeed.goal,
      goalRateKgPerWeek: defaultProfileSeed.goalRateKgPerWeek,
    });
  };

  const finish = async () => {
    await settings.setOnboardingDone(true);
    router.replace('/');
  };

  const next = async () => {
    if (step === 'structure') await persistStructure();
    if (step === 'profile') await persistProfile();
    setStep(STEPS[stepIndex + 1]);
  };

  const stepContent = useMemo(() => {
    switch (step) {
      case 'welcome':
        return (
          <View className="flex-1 justify-center gap-4 py-12">
            <Title className="text-4xl">{t('onboarding.welcome.title')}</Title>
            <Subtitle className="text-lg">{t('onboarding.welcome.subtitle')}</Subtitle>
            <Button title={t('onboarding.welcome.start')} size="lg" onPress={next} className="mt-6" />
            <Button title={t('onboarding.welcome.skipAll')} variant="ghost" onPress={finish} />
          </View>
        );
      case 'structure':
        return (
          <StepFrame
            title={t('onboarding.structure.title')}
            subtitle={t('onboarding.structure.subtitle')}
          >
            <WeekStructureEditor value={structure} onChange={setStructure} />
          </StepFrame>
        );
      case 'profile':
        return (
          <StepFrame
            title={t('onboarding.profile.title')}
            subtitle={t('onboarding.profile.subtitle')}
          >
            <ProfileEditor value={profile} onChange={setProfile} />
          </StepFrame>
        );
      case 'equipment':
        return (
          <StepFrame
            title={t('onboarding.equipment.title')}
            subtitle={t('onboarding.equipment.subtitle')}
          >
            <EquipmentExerciseEditor />
          </StepFrame>
        );
      case 'preferences':
        return (
          <StepFrame
            title={t('onboarding.preferences.title')}
            subtitle={t('onboarding.preferences.subtitle')}
          >
            <View className="gap-5">
              <View>
                <Label>{t('settings.language.title')}</Label>
                <SegmentedControl
                  options={[
                    { value: 'de', label: t('settings.language.de') },
                    { value: 'en', label: t('settings.language.en') },
                  ]}
                  value={settings.language}
                  onChange={(language) => void settings.setLanguage(language)}
                />
              </View>
              <View>
                <Label>{t('settings.theme.title')}</Label>
                <SegmentedControl
                  options={[
                    { value: 'system', label: t('settings.theme.system') },
                    { value: 'light', label: t('settings.theme.light') },
                    { value: 'dark', label: t('settings.theme.dark') },
                  ]}
                  value={settings.theme}
                  onChange={(theme) => void settings.setTheme(theme)}
                />
              </View>
            </View>
          </StepFrame>
        );
      case 'finish':
        return (
          <View className="flex-1 justify-center gap-4 py-12">
            <Title className="text-4xl">{t('onboarding.finish.title')}</Title>
            <Subtitle className="text-lg">{t('onboarding.finish.subtitle')}</Subtitle>
            <Button title={t('onboarding.finish.cta')} size="lg" onPress={finish} className="mt-6" />
          </View>
        );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, structure, profile, settings.language, settings.theme, t]);

  return (
    <Screen>
      {stepContent}
      {step !== 'welcome' && step !== 'finish' && (
        <View className="mt-8 flex-row items-center justify-between">
          <Button
            title={t('common.back')}
            variant="secondary"
            onPress={() => setStep(STEPS[stepIndex - 1])}
          />
          <View className="flex-row gap-2">
            <Button title={t('common.skip')} variant="secondary" onPress={() => setStep(STEPS[stepIndex + 1])} />
            <Button title={t('common.next')} onPress={next} />
          </View>
        </View>
      )}
    </Screen>
  );
}

function StepFrame({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle: string;
  children: React.ReactNode;
}) {
  return (
    <View className="gap-4">
      <View className="gap-1 pt-4">
        <Title>{title}</Title>
        <Subtitle>{subtitle}</Subtitle>
      </View>
      {children}
    </View>
  );
}
