/**
 * Equipment + exercise list editor. Works directly against the DB (bootstrap
 * has already seeded defaults) — used by onboarding and settings.
 */
import { useCallback, useEffect, useState } from 'react';
import { Pressable, Switch, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { Plus, Trash2 } from 'lucide-react-native';
import type { Equipment, Exercise } from '@/db/schema';
import { UI_COLORS } from '@/constants/uiColors';
import {
  createExercise,
  deleteExercise,
  listEquipment,
  listExercises,
  setEquipmentAvailable,
  updateExercise,
} from '@/db/repos/exerciseRepo';
import { Card } from '@/components/ui/Card';
import { ExercisePictogram } from '@/components/training/ExercisePictogram';
import { Field } from '@/components/ui/Field';
import { Button } from '@/components/ui/Button';
import { Body, Muted, SectionTitle } from '@/components/ui/Text';

export function EquipmentExerciseEditor() {
  const { t } = useTranslation();
  const [equipment, setEquipment] = useState<Equipment[]>([]);
  const [exercises, setExercises] = useState<Exercise[]>([]);
  const [newExercise, setNewExercise] = useState('');

  const refresh = useCallback(async () => {
    const [eq, ex] = await Promise.all([listEquipment(), listExercises()]);
    setEquipment(eq);
    setExercises(ex);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addExercise = async () => {
    const name = newExercise.trim();
    if (!name) return;
    await createExercise({ name });
    setNewExercise('');
    await refresh();
  };

  return (
    <View className="gap-4">
      <Card>
        <SectionTitle>{t('onboarding.equipment.equipmentTitle')}</SectionTitle>
        <View className="mt-2 gap-2">
          {equipment.map((item) => (
            <View key={item.id} className="flex-row items-center justify-between">
              <Body className={item.available ? '' : 'opacity-40'}>{item.name}</Body>
              <Switch
                value={item.available}
                onValueChange={async (available) => {
                  await setEquipmentAvailable(item.id, available);
                  await refresh();
                }}
              />
            </View>
          ))}
        </View>
      </Card>

      <Card>
        <SectionTitle>{t('onboarding.equipment.exercisesTitle')}</SectionTitle>
        <View className="mt-2 gap-2">
          {exercises.map((item) => (
            <View key={item.id} className="flex-row items-center gap-2">
              <ExercisePictogram slug={item.slug} size={32} />
              <View className="flex-1">
                <Body>{item.name}</Body>
                {item.isWeighted && <Muted>{t('onboarding.equipment.weighted')}</Muted>}
              </View>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await updateExercise(item.id, { isWeighted: !item.isWeighted });
                  await refresh();
                }}
                className="rounded-lg border border-border dark:border-border-dark px-2 py-1 active:opacity-60"
              >
                <Muted>+kg</Muted>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={async () => {
                  await deleteExercise(item.id);
                  await refresh();
                }}
                className="p-1 active:opacity-60"
              >
                <Trash2 size={18} color="#dc2626" />
              </Pressable>
            </View>
          ))}
        </View>
        <View className="mt-3 flex-row items-end gap-2">
          <Field
            className="flex-1"
            label={t('training.addExercise')}
            value={newExercise}
            onChangeText={setNewExercise}
            onSubmitEditing={addExercise}
          />
          <Button
            title={t('common.add')}
            size="md"
            icon={<Plus size={16} color={UI_COLORS.ink.light} />}
            onPress={addExercise}
          />
        </View>
      </Card>
    </View>
  );
}
