/**
 * Body profile editor (§5). Controlled — used by onboarding and settings.
 * Phase 1 only stores these values; calorie math arrives in Phase 2.
 */
import { View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Field } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Label, Muted } from '@/components/ui/Text';

export interface ProfileDraft {
  heightCm: string;
  age: string;
  sex: 'male' | 'female' | 'other';
  weightKg: string;
}

interface Props {
  value: ProfileDraft;
  onChange: (value: ProfileDraft) => void;
}

export function ProfileEditor({ value, onChange }: Props) {
  const { t } = useTranslation();
  return (
    <View className="gap-4">
      <View className="flex-row gap-3">
        <Field
          className="flex-1"
          label={t('onboarding.profile.height')}
          value={value.heightCm}
          onChangeText={(v) => onChange({ ...value, heightCm: v })}
          keyboardType="numeric"
          maxLength={3}
        />
        <Field
          className="flex-1"
          label={t('onboarding.profile.age')}
          value={value.age}
          onChangeText={(v) => onChange({ ...value, age: v })}
          keyboardType="numeric"
          maxLength={3}
        />
      </View>
      <View>
        <Label>{t('onboarding.profile.sex')}</Label>
        <SegmentedControl
          options={[
            { value: 'male', label: t('onboarding.profile.male') },
            { value: 'female', label: t('onboarding.profile.female') },
            { value: 'other', label: t('onboarding.profile.other') },
          ]}
          value={value.sex}
          onChange={(sex) => onChange({ ...value, sex })}
        />
      </View>
      <Field
        label={t('onboarding.profile.weight')}
        value={value.weightKg}
        onChangeText={(v) => onChange({ ...value, weightKg: v })}
        keyboardType="decimal-pad"
        maxLength={6}
      />
      <View>
        <Label>{t('onboarding.profile.goal')}</Label>
        <Muted>{t('onboarding.profile.leanGain')}</Muted>
      </View>
    </View>
  );
}
