/**
 * Body-composition screen: record and update weight, body fat, muscle mass,
 * bone mass and basal metabolic rate (Grundumsatz) per day. BMI is derived
 * from the entered weight and the profile height. Reached from the Today
 * header; stack screen like Settings/Stats. One measurement per date (upsert);
 * tapping a history entry loads it for editing.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { format, parseISO } from 'date-fns';
import { Trash2, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field } from '@/components/ui/Field';
import { Body, Label, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import {
  deleteMeasurement,
  listMeasurements,
  upsertMeasurement,
  type MeasurementInput,
} from '@/db/repos/bodyRepo';
import { getProfile } from '@/db/repos/profileRepo';
import { bmiCategory, bmiFrom, formatWeightChange } from '@/domain/bodyStats';
import { dateFnsLocale } from '@/i18n';
import type { BodyMeasurement } from '@/db/schema';

function todayIso(): string {
  return format(new Date(), 'yyyy-MM-dd');
}

/** Parse a user-typed number (accepts comma), returns null when blank/invalid. */
function num(value: string): number | null {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const parsed = Number(trimmed.replace(',', '.'));
  return Number.isFinite(parsed) ? parsed : null;
}

const EMPTY = { date: todayIso(), weight: '', fat: '', muscle: '', bone: '', bmr: '' };

export default function BodyScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';

  const [form, setForm] = useState(EMPTY);
  const [heightCm, setHeightCm] = useState<number | null>(null);
  const [history, setHistory] = useState<BodyMeasurement[]>([]);
  const [saving, setSaving] = useState(false);

  const set = (patch: Partial<typeof form>) => setForm((f) => ({ ...f, ...patch }));

  const reload = useCallback(async () => {
    setHistory(await listMeasurements(365));
  }, []);

  useEffect(() => {
    void getProfile().then((p) => setHeightCm(p?.heightCm ?? null));
    void reload();
  }, [reload]);

  const close = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const weightKg = num(form.weight);
  const weightValid = weightKg !== null && weightKg > 0;
  const bmi = weightValid ? bmiFrom(weightKg, heightCm) : null;

  // Does a stored measurement already exist for the date in the form?
  const existing = useMemo(
    () => history.find((m) => m.date === form.date.trim()),
    [history, form.date]
  );

  const loadForEdit = (m: BodyMeasurement) => {
    setForm({
      date: m.date,
      weight: String(m.weightKg),
      fat: m.fatPercent != null ? String(m.fatPercent) : '',
      muscle: m.muscleMassKg != null ? String(m.muscleMassKg) : '',
      bone: m.boneMassKg != null ? String(m.boneMassKg) : '',
      bmr: m.bmrKcal != null ? String(m.bmrKcal) : '',
    });
  };

  const save = async () => {
    if (!weightValid || saving) return;
    const input: MeasurementInput = {
      weightKg,
      fatPercent: num(form.fat),
      muscleMassKg: num(form.muscle),
      boneMassKg: num(form.bone),
      bmrKcal: num(form.bmr),
    };
    setSaving(true);
    try {
      await upsertMeasurement(form.date.trim() || todayIso(), input);
      await reload();
      setForm({ ...EMPTY, date: todayIso() });
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!existing || saving) return;
    setSaving(true);
    try {
      await deleteMeasurement(existing.date);
      await reload();
      setForm({ ...EMPTY, date: todayIso() });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between">
        <Title>{t('bodyLog.title')}</Title>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={t('common.close')}
          onPress={close}
          className="p-2 active:opacity-60"
        >
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      <Muted className="mt-0.5">{t('bodyLog.subtitle')}</Muted>

      <Card className="mt-4">
        <View className="flex-row items-center justify-between">
          <SectionTitle>
            {existing ? t('bodyLog.editEntry') : t('bodyLog.newEntry')}
          </SectionTitle>
          {existing ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={t('common.delete')}
              onPress={() => void remove()}
              className="p-1.5 active:opacity-60"
            >
              <Trash2 size={18} color={uiColor('danger', dark)} />
            </Pressable>
          ) : null}
        </View>

        <View className="mt-3 gap-3">
          <Field
            label={t('bodyLog.date')}
            value={form.date}
            onChangeText={(date) => set({ date })}
            autoCapitalize="none"
            autoCorrect={false}
            placeholder="YYYY-MM-DD"
            maxLength={10}
            style={TABULAR}
          />
          <View className="flex-row gap-3">
            <Field
              className="flex-1"
              label={`${t('bodyLog.weight')} (kg)`}
              value={form.weight}
              onChangeText={(weight) => set({ weight })}
              keyboardType="numeric"
              maxLength={6}
              style={TABULAR}
            />
            <Field
              className="flex-1"
              label={`${t('bodyLog.fat')} (%)`}
              value={form.fat}
              onChangeText={(fat) => set({ fat })}
              keyboardType="numeric"
              maxLength={5}
              style={TABULAR}
            />
          </View>
          <View className="flex-row gap-3">
            <Field
              className="flex-1"
              label={`${t('bodyLog.muscle')} (kg)`}
              value={form.muscle}
              onChangeText={(muscle) => set({ muscle })}
              keyboardType="numeric"
              maxLength={6}
              style={TABULAR}
            />
            <Field
              className="flex-1"
              label={`${t('bodyLog.bone')} (kg)`}
              value={form.bone}
              onChangeText={(bone) => set({ bone })}
              keyboardType="numeric"
              maxLength={5}
              style={TABULAR}
            />
          </View>
          <Field
            label={`${t('bodyLog.bmr')} (kcal)`}
            value={form.bmr}
            onChangeText={(bmr) => set({ bmr })}
            keyboardType="numeric"
            maxLength={5}
            style={TABULAR}
          />

          <View className="flex-row items-center justify-between rounded-xl bg-surface dark:bg-surface-dark px-3 py-2.5">
            <Muted>{t('bodyLog.bmi')}</Muted>
            {bmi != null ? (
              <Body style={TABULAR} className="font-bold">
                {bmi.toFixed(1)} · {t(`bodyLog.bmiCategory.${bmiCategory(bmi)}`)}
              </Body>
            ) : (
              <Muted>{weightValid ? t('bodyLog.bmiNoHeight') : '–'}</Muted>
            )}
          </View>

          <View className="flex-row justify-end">
            <Button title={t('common.save')} onPress={() => void save()} disabled={!weightValid} loading={saving} />
          </View>
        </View>
      </Card>

      <View className="mt-6">
        <Label>{t('bodyLog.history')}</Label>
        {history.length === 0 ? (
          <Card>
            <Muted>{t('bodyLog.empty')}</Muted>
          </Card>
        ) : (
          <View className="gap-2">
            {history
              .slice()
              .reverse()
              .map((m, i, reversed) => {
                const prev = reversed[i + 1];
                const change = prev ? m.weightKg - prev.weightKg : 0;
                const changePercent = prev && prev.weightKg > 0 ? (change / prev.weightKg) * 100 : 0;
                return (
                  <Card key={m.id} onPress={() => loadForEdit(m)}>
                    <View className="flex-row items-center justify-between">
                      <Body className="font-semibold">
                        {format(parseISO(m.date), 'd. MMM yyyy', { locale: dateFnsLocale() })}
                      </Body>
                      <Body style={TABULAR} className="font-bold">
                        {m.weightKg.toFixed(1)} kg
                      </Body>
                    </View>
                    <View className="mt-0.5 flex-row items-center justify-between">
                      <Muted style={TABULAR}>
                        {[
                          m.fatPercent != null ? `${t('bodyLog.fatShort')} ${m.fatPercent}%` : null,
                          m.muscleMassKg != null ? `${t('bodyLog.muscleShort')} ${m.muscleMassKg} kg` : null,
                        ]
                          .filter(Boolean)
                          .join(' · ') || ' '}
                      </Muted>
                      {prev ? (
                        <Muted
                          style={TABULAR}
                          className={
                            change < 0
                              ? 'text-success dark:text-success-dark'
                              : change > 0
                                ? 'text-danger dark:text-danger-dark'
                                : ''
                          }
                        >
                          {formatWeightChange(change, changePercent)}
                        </Muted>
                      ) : null}
                    </View>
                  </Card>
                );
              })}
          </View>
        )}
      </View>
    </Screen>
  );
}
