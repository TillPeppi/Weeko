/**
 * Week import (§6.2): paste JSON or pick a file → Zod validation with
 * localized path errors → rule-engine warnings (overridable) → editable
 * timeline preview → apply (replaces target week after confirmation).
 * Also: create a new week from a saved template.
 */
import { useCallback, useEffect, useState } from 'react';
import { Platform, Pressable, TextInput, View } from 'react-native';
import { router } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import { format, parseISO } from 'date-fns';
import { AlertTriangle, FileJson, X } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Field, TimeField } from '@/components/ui/Field';
import { Body, Label, Muted, SectionTitle, Subtitle, TABULAR, Title } from '@/components/ui/Text';
import { uiColor } from '@/constants/uiColors';
import { BlockRow } from '@/components/timeline/BlockRow';
import { parseWeekImport } from '@/domain/parseWeekImport';
import type { ImportIssue } from '@/domain/importErrors';
import { checkWeekRules, type RuleWarning } from '@/domain/rules';
import { weekImportSchema, type WeekImportParsed } from '@/schemas/week';
import { mapImportIssues } from '@/domain/importErrors';
import { BLOCK_TYPES, type BlockType } from '@/domain/types';
import { addDaysIso, isoWeekOf, isoWeekday } from '@/domain/time';
import { BLOCK_COLORS } from '@/constants/blockColors';
import {
  applyWeekImport,
  getBlocksForDate,
  getWeek,
  listWeekTemplates,
  templateToImport,
} from '@/db/repos/weekRepo';
import { listOpenTasks } from '@/db/repos/taskRepo';
import type { WeekTemplate } from '@/db/schema';
import { rescheduleAll } from '@/notifications/scheduler';
import { useWeekStore, todayIso } from '@/stores/weekStore';
import { useTaskStore } from '@/stores/taskStore';
import { dateFnsLocale } from '@/i18n';

type Phase = 'input' | 'preview';

interface BlockEditTarget {
  dayIndex: number;
  blockIndex: number;
}

export default function ImportScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const [phase, setPhase] = useState<Phase>('input');
  const [jsonText, setJsonText] = useState('');
  const [errors, setErrors] = useState<ImportIssue[]>([]);
  const [draft, setDraft] = useState<WeekImportParsed | null>(null);
  const [warnings, setWarnings] = useState<RuleWarning[]>([]);
  const [editTarget, setEditTarget] = useState<BlockEditTarget | null>(null);
  const [confirmReplace, setConfirmReplace] = useState(false);
  const [applying, setApplying] = useState(false);
  const [templates, setTemplates] = useState<WeekTemplate[]>([]);

  useEffect(() => {
    void listWeekTemplates().then(setTemplates);
  }, []);

  const validate = useCallback((text: string) => {
    const result = parseWeekImport(text);
    if (result.ok) {
      setDraft(result.week);
      setWarnings(result.warnings);
      setErrors([]);
      setPhase('preview');
    } else {
      setErrors(result.errors);
    }
  }, []);

  const pickFile = async () => {
    const result = await DocumentPicker.getDocumentAsync({
      type: 'application/json',
      copyToCacheDirectory: true,
    });
    if (result.canceled || !result.assets[0]) return;
    const asset = result.assets[0];
    let text: string;
    if (Platform.OS === 'web' && asset.file) {
      text = await asset.file.text();
    } else {
      text = await FileSystem.readAsStringAsync(asset.uri);
    }
    setJsonText(text);
    validate(text);
  };

  const useTemplate = (template: WeekTemplate) => {
    // target: next week (planning happens on Sundays for the coming week)
    const nextMonday = mondayOf(addDaysIso(todayIso(), 7));
    const target = { ...isoWeekOf(nextMonday), mondayDate: nextMonday };
    const imported = templateToImport(template, target);
    const revalidated = weekImportSchema.safeParse(imported);
    if (!revalidated.success) {
      setErrors(mapImportIssues(revalidated.error));
      return;
    }
    setDraft(revalidated.data);
    setWarnings(checkWeekRules(revalidated.data));
    setErrors([]);
    setPhase('preview');
  };

  const requestApply = async () => {
    if (!draft) return;
    const existing = await getWeek(draft.week.year, draft.week.isoWeek);
    if (existing) {
      setConfirmReplace(true);
    } else {
      await apply();
    }
  };

  const apply = async () => {
    if (!draft) return;
    setConfirmReplace(false);
    setApplying(true);
    try {
      // re-validate after manual edits (hard rules stay hard)
      const revalidated = weekImportSchema.safeParse(draft);
      if (!revalidated.success) {
        setErrors(mapImportIssues(revalidated.error));
        setPhase('input');
        return;
      }
      await applyWeekImport(revalidated.data);
      useWeekStore.getState().setWeek(draft.week.year, draft.week.isoWeek);
      await useTaskStore.getState().refresh();
      const [blocks, tasks] = await Promise.all([getBlocksForDate(todayIso()), listOpenTasks()]);
      await rescheduleAll(blocks, tasks);
      router.back();
    } finally {
      setApplying(false);
    }
  };

  const patchBlock = (
    target: BlockEditTarget,
    patch: Partial<WeekImportParsed['days'][number]['blocks'][number]> | null
  ) => {
    if (!draft) return;
    const days = draft.days.map((day, di) => {
      if (di !== target.dayIndex) return day;
      const blocks =
        patch === null
          ? day.blocks.filter((_, bi) => bi !== target.blockIndex)
          : day.blocks.map((b, bi) => (bi === target.blockIndex ? { ...b, ...patch } : b));
      return { ...day, blocks };
    });
    const updated = { ...draft, days };
    setDraft(updated);
    setWarnings(checkWeekRules(updated));
  };

  return (
    <Screen>
      <View className="flex-row items-center justify-between pt-2">
        <Title>{t('week.import.title')}</Title>
        <Pressable accessibilityRole="button" onPress={() => router.back()} className="p-2 active:opacity-60">
          <X size={22} color={uiColor('muted', dark)} />
        </Pressable>
      </View>
      <Subtitle className="mt-1">{t('week.import.subtitle')}</Subtitle>

      {phase === 'input' && (
        <View className="mt-5 gap-4">
          <View>
            <Label>{t('week.import.pasteLabel')}</Label>
            <TextInput
              multiline
              value={jsonText}
              onChangeText={setJsonText}
              placeholder={t('week.import.pastePlaceholder')}
              placeholderTextColor="#a49d8e"
              autoCapitalize="none"
              autoCorrect={false}
              className="min-h-40 rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-3 font-mono text-sm text-ink dark:text-ink-dark"
              style={{ textAlignVertical: 'top' }}
            />
          </View>
          <View className="flex-row gap-3">
            <Button
              title={t('week.import.pickFile')}
              variant="secondary"
              icon={<FileJson size={18} color={uiColor('muted', dark)} />}
              onPress={pickFile}
              className="flex-1"
            />
            <Button
              title={t('week.import.validate')}
              onPress={() => validate(jsonText)}
              disabled={jsonText.trim() === ''}
              className="flex-1"
            />
          </View>

          {errors.length > 0 && (
            <Card className="border-danger dark:border-danger-dark">
              <SectionTitle className="text-danger dark:text-danger-dark">
                {t('week.import.errorsTitle')}
              </SectionTitle>
              <View className="mt-2 gap-1.5">
                {errors.map((issue, index) => (
                  <Body key={`${issue.path}-${index}`} className="text-sm">
                    {issueLocation(issue, t)}
                    {t(issue.key)}
                  </Body>
                ))}
              </View>
            </Card>
          )}

          <Card>
            <SectionTitle>{t('week.import.templates.title')}</SectionTitle>
            {templates.length === 0 ? (
              <Muted className="mt-2">{t('week.import.templates.empty')}</Muted>
            ) : (
              <View className="mt-2 gap-2">
                {templates.map((template) => (
                  <View key={template.id} className="flex-row items-center justify-between">
                    <Body className="flex-1">{template.name}</Body>
                    <Button
                      title={t('week.import.templates.createFrom')}
                      size="sm"
                      variant="secondary"
                      onPress={() => useTemplate(template)}
                    />
                  </View>
                ))}
              </View>
            )}
          </Card>
        </View>
      )}

      {phase === 'preview' && draft && (
        <View className="mt-5 gap-4">
          <View className="flex-row items-center justify-between">
            <SectionTitle style={TABULAR}>
              {t('week.weekOfYear', { week: draft.week.isoWeek, year: draft.week.year })} ·{' '}
              {t('week.import.preview.title')}
            </SectionTitle>
          </View>
          <Muted>{t('week.import.preview.subtitle')}</Muted>

          {warnings.length > 0 && (
            <Card className="border-warning dark:border-warning-dark">
              <View className="flex-row items-center gap-2">
                <AlertTriangle size={18} color={uiColor('warning', dark)} />
                <SectionTitle className="text-warning dark:text-warning-dark">
                  {t('week.import.warningsTitle')}
                </SectionTitle>
              </View>
              <Muted className="mt-1">{t('week.import.warningsSubtitle')}</Muted>
              <View className="mt-2 gap-1.5">
                {warnings.map((warning, index) => (
                  <Body key={`${warning.rule}-${index}`} className="text-sm">
                    {t(warning.key, warning.params)}
                  </Body>
                ))}
              </View>
            </Card>
          )}

          {draft.days.map((day, dayIndex) => (
            <View key={day.date} className="gap-2">
              <SectionTitle style={TABULAR}>
                {format(parseISO(day.date), 'EEEE, d. MMM', { locale: dateFnsLocale() })}
              </SectionTitle>
              {day.blocks.length === 0 ? (
                <Muted>{t('common.none')}</Muted>
              ) : (
                day.blocks.map((block, blockIndex) => (
                  <BlockRow
                    key={`${day.date}-${blockIndex}`}
                    block={{
                      key: `${day.date}-${blockIndex}`,
                      type: block.type,
                      start: block.start,
                      end: block.end,
                      title: block.title,
                    }}
                    onPress={() => setEditTarget({ dayIndex, blockIndex })}
                  />
                ))
              )}
            </View>
          ))}

          <View className="flex-row gap-3 pb-4">
            <Button
              title={t('common.back')}
              variant="secondary"
              onPress={() => setPhase('input')}
              className="flex-1"
            />
            <Button
              title={t('week.import.preview.apply')}
              onPress={requestApply}
              loading={applying}
              className="flex-1"
            />
          </View>
        </View>
      )}

      {editTarget && draft && (
        <BlockEditor
          block={draft.days[editTarget.dayIndex].blocks[editTarget.blockIndex]}
          onSave={(patch) => {
            patchBlock(editTarget, patch);
            setEditTarget(null);
          }}
          onDelete={() => {
            patchBlock(editTarget, null);
            setEditTarget(null);
          }}
          onClose={() => setEditTarget(null)}
        />
      )}

      <ConfirmDialog
        visible={confirmReplace}
        title={t('week.import.preview.replaceTitle')}
        message={t('week.import.preview.replaceMessage', {
          week: draft?.week.isoWeek,
          year: draft?.week.year,
        })}
        destructive
        onConfirm={apply}
        onCancel={() => setConfirmReplace(false)}
      />
    </Screen>
  );
}

function issueLocation(
  issue: ImportIssue,
  t: (key: string, params?: Record<string, unknown>) => string
): string {
  if (issue.day !== undefined && issue.block !== undefined) {
    return `${t('week.import.atDayBlock', { day: issue.day, block: issue.block })}: `;
  }
  if (issue.day !== undefined) {
    return `${t('week.import.atDay', { day: issue.day })}: `;
  }
  if (issue.task !== undefined) {
    return `${t('week.import.atTask', { task: issue.task })}: `;
  }
  return '';
}

function mondayOf(date: string): string {
  return addDaysIso(date, 1 - isoWeekday(date));
}

interface EditableBlock {
  type: BlockType;
  start: string;
  end: string;
  title: string;
}

function BlockEditor({
  block,
  onSave,
  onDelete,
  onClose,
}: {
  block: EditableBlock;
  onSave: (patch: EditableBlock) => void;
  onDelete: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const [edit, setEdit] = useState<EditableBlock>({ ...block });

  return (
    <View className="absolute inset-0 items-center justify-center bg-black/50 p-6">
      <View className="w-full max-w-md gap-3 rounded-2xl bg-surface dark:bg-surface-dark p-5">
        <SectionTitle>{t('week.import.preview.editBlock')}</SectionTitle>
        <Field
          label={t('week.import.preview.blockTitle')}
          value={edit.title}
          onChangeText={(title) => setEdit({ ...edit, title })}
        />
        <View>
          <Label>{t('week.import.preview.blockType')}</Label>
          <View className="flex-row flex-wrap gap-1.5">
            {BLOCK_TYPES.map((type) => {
              const palette = BLOCK_COLORS[type];
              const selected = edit.type === type;
              return (
                <Pressable
                  key={type}
                  onPress={() => setEdit({ ...edit, type })}
                  className={`rounded-full border px-2.5 py-1 ${selected ? `${palette.bgClass} ${palette.borderClass}` : 'border-border dark:border-border-dark'}`}
                >
                  <Body className={`text-xs ${selected ? palette.textClass : ''}`}>
                    {t(`blockTypes.${type}`)}
                  </Body>
                </Pressable>
              );
            })}
          </View>
        </View>
        <View className="flex-row gap-3">
          <TimeField
            className="flex-1"
            label={t('week.import.preview.blockStart')}
            value={edit.start}
            onChange={(start) => setEdit({ ...edit, start })}
          />
          <TimeField
            className="flex-1"
            label={t('week.import.preview.blockEnd')}
            value={edit.end}
            onChange={(end) => setEdit({ ...edit, end })}
          />
        </View>
        <View className="mt-2 flex-row items-center justify-between">
          <Button
            title={t('week.import.preview.deleteBlock')}
            variant="danger"
            size="sm"
            onPress={onDelete}
          />
          <View className="flex-row gap-2">
            <Button title={t('common.cancel')} variant="secondary" size="sm" onPress={onClose} />
            <Button
              title={t('common.save')}
              size="sm"
              onPress={() => onSave(edit)}
              disabled={edit.title.trim() === ''}
            />
          </View>
        </View>
      </View>
    </View>
  );
}
