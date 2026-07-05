/**
 * Editor for the weekly structure (work hours, location, "done by", fixed
 * blocks per weekday). Used by onboarding and settings. Controlled component:
 * operates on WeekdayStructureSeed[] via value/onChange.
 */
import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { Plus, X } from 'lucide-react-native';
import type { WeekdayStructureSeed } from '@/db/seeds';
import type { FixedBlockSeed } from '@/db/schema';
import { BLOCK_TYPES, type BlockType } from '@/domain/types';
import { isValidTime } from '@/domain/time';
import { BLOCK_COLORS } from '@/constants/blockColors';
import { UI_COLORS, uiColor } from '@/constants/uiColors';
import { Card } from '@/components/ui/Card';
import { Field, TimeField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Muted, SectionTitle } from '@/components/ui/Text';
import { Button } from '@/components/ui/Button';

interface Props {
  value: WeekdayStructureSeed[];
  onChange: (value: WeekdayStructureSeed[]) => void;
}

/** Fixed-block titles: seed entries carry i18n keys, user entries raw text. */
export function fixedBlockTitle(titleKey: string, t: (key: string) => string): string {
  return titleKey.startsWith('seeds.') ? t(titleKey) : titleKey;
}

type WorkSetting = 'office' | 'home' | 'none';

export function WeekStructureEditor({ value, onChange }: Props) {
  const { t } = useTranslation();

  const patchDay = (weekday: number, patch: Partial<WeekdayStructureSeed>) => {
    onChange(value.map((d) => (d.weekday === weekday ? { ...d, ...patch } : d)));
  };

  return (
    <View className="gap-3">
      {value.map((day) => (
        <Card key={day.weekday}>
          <SectionTitle>{t(`weekdays.${day.weekday}`)}</SectionTitle>

          <Muted className="mt-3 mb-1">{t('onboarding.structure.workLocation')}</Muted>
          <SegmentedControl<WorkSetting>
            options={[
              { value: 'office', label: t('onboarding.structure.office') },
              { value: 'home', label: t('onboarding.structure.home') },
              { value: 'none', label: t('onboarding.structure.noWork') },
            ]}
            value={(day.workLocation ?? 'none') as WorkSetting}
            onChange={(loc) =>
              patchDay(day.weekday, {
                workLocation: loc === 'none' ? null : loc,
                workStart: loc === 'none' ? null : (day.workStart ?? '07:30'),
                workEnd: loc === 'none' ? null : (day.workEnd ?? '17:00'),
              })
            }
          />

          {day.workLocation !== null && (
            <View className="mt-3 flex-row gap-3">
              <TimeField
                className="flex-1"
                label={t('onboarding.structure.workStart')}
                value={day.workStart ?? ''}
                onChange={(v) => patchDay(day.weekday, { workStart: v })}
              />
              <TimeField
                className="flex-1"
                label={t('onboarding.structure.workEnd')}
                value={day.workEnd ?? ''}
                onChange={(v) => patchDay(day.weekday, { workEnd: v })}
              />
            </View>
          )}

          <TimeField
            className="mt-3"
            label={t('onboarding.structure.doneBy')}
            value={day.doneBy ?? ''}
            onChange={(v) => patchDay(day.weekday, { doneBy: v || null })}
          />

          <Muted className="mt-4 mb-2">{t('onboarding.structure.fixedBlocks')}</Muted>
          <FixedBlockList
            blocks={day.fixedBlocks}
            onChange={(fixedBlocks) => patchDay(day.weekday, { fixedBlocks })}
          />
        </Card>
      ))}
    </View>
  );
}

function FixedBlockList({
  blocks,
  onChange,
}: {
  blocks: FixedBlockSeed[];
  onChange: (blocks: FixedBlockSeed[]) => void;
}) {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState<FixedBlockSeed>({
    type: 'hobby',
    start: '19:00',
    end: '20:00',
    titleKey: '',
  });

  const commit = () => {
    if (!draft.titleKey.trim() || !isValidTime(draft.start) || !isValidTime(draft.end)) return;
    onChange([...blocks, draft]);
    setDraft({ type: 'hobby', start: '19:00', end: '20:00', titleKey: '' });
    setAdding(false);
  };

  return (
    <View className="gap-2">
      {blocks.length === 0 && !adding && (
        <Muted>{t('onboarding.structure.noFixedBlocks')}</Muted>
      )}
      {blocks.map((block, index) => {
        const palette = BLOCK_COLORS[block.type];
        return (
          <View
            key={`${block.titleKey}-${index}`}
            className={`flex-row items-center gap-2 rounded-lg border-2 px-3 py-2 ${palette.bgClass} ${palette.borderClass}`}
          >
            <Text className={`flex-1 text-sm font-bold ${palette.textClass}`} numberOfLines={1}>
              {fixedBlockTitle(block.titleKey, t)} · {block.start}–{block.end}
            </Text>
            <Pressable
              accessibilityRole="button"
              onPress={() => onChange(blocks.filter((_, i) => i !== index))}
              className="p-1 active:opacity-60"
            >
              <X size={16} color={UI_COLORS.ink.light} />
            </Pressable>
          </View>
        );
      })}

      {adding ? (
        <View className="gap-2 rounded-xl border border-border dark:border-border-dark p-3">
          <Field
            label={t('week.import.preview.blockTitle')}
            value={draft.titleKey}
            onChangeText={(v) => setDraft({ ...draft, titleKey: v })}
          />
          <View className="flex-row flex-wrap gap-1.5">
            {BLOCK_TYPES.map((type: BlockType) => {
              const palette = BLOCK_COLORS[type];
              const selected = draft.type === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setDraft({ ...draft, type })}
                  className={`rounded-full border px-2.5 py-1 ${selected ? `${palette.bgClass} ${palette.borderClass}` : 'border-border dark:border-border-dark'}`}
                >
                  <Text
                    className={`text-xs ${selected ? palette.textClass : 'text-ink-muted dark:text-ink-muted-dark'}`}
                  >
                    {t(`blockTypes.${type}`)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
          <View className="flex-row gap-3">
            <TimeField
              className="flex-1"
              label={t('common.from')}
              value={draft.start}
              onChange={(v) => setDraft({ ...draft, start: v })}
            />
            <TimeField
              className="flex-1"
              label={t('common.to')}
              value={draft.end}
              onChange={(v) => setDraft({ ...draft, end: v })}
            />
          </View>
          <View className="flex-row justify-end gap-2">
            <Button title={t('common.cancel')} variant="secondary" size="sm" onPress={() => setAdding(false)} />
            <Button title={t('common.add')} size="sm" onPress={commit} />
          </View>
        </View>
      ) : (
        <Button
          title={t('common.add')}
          variant="secondary"
          size="sm"
          icon={<Plus size={16} color={uiColor('muted', dark)} />}
          onPress={() => setAdding(true)}
          className="self-start"
        />
      )}
    </View>
  );
}
