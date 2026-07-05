/**
 * Task pool (§6.4): one-off & recurring tasks with category, duration
 * estimate and optional time window. Week-bound tasks arrive via import.
 * Notifications are scheduled on create/update, cancelled on completion.
 */
import { useCallback, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { useTranslation } from 'react-i18next';
import { useColorScheme } from 'nativewind';
import { FlashList } from '@shopify/flash-list';
import { CheckCircle2, Circle, Plus, Trash2 } from 'lucide-react-native';
import { Screen } from '@/components/Screen';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Field, TimeField } from '@/components/ui/Field';
import { SegmentedControl } from '@/components/ui/SegmentedControl';
import { Body, Label, Muted, SectionTitle, TABULAR, Title } from '@/components/ui/Text';
import { UI_COLORS, uiColor } from '@/constants/uiColors';
import { TASK_CATEGORIES } from '@/db/seeds';
import type { Task } from '@/db/schema';
import { useTaskStore } from '@/stores/taskStore';
import { isValidIsoDate, isValidTime } from '@/domain/time';

type Recurrence = 'none' | 'daily' | 'weekly';

interface TaskDraft {
  id?: number;
  title: string;
  category: string;
  estimatedMinutes: string;
  recurrence: Recurrence;
  windowDay: string;
  windowStart: string;
  windowEnd: string;
}

const emptyDraft: TaskDraft = {
  title: '',
  category: 'other',
  estimatedMinutes: '',
  recurrence: 'none',
  windowDay: '',
  windowStart: '',
  windowEnd: '',
};

export default function TasksScreen() {
  const { t } = useTranslation();
  const { colorScheme } = useColorScheme();
  const dark = colorScheme === 'dark';
  const store = useTaskStore();
  const [draft, setDraft] = useState<TaskDraft | null>(null);

  useFocusEffect(
    useCallback(() => {
      void store.refresh();
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
  );

  const categories = useMemo(() => {
    const fromTasks = store.tasks.map((task) => task.category);
    return [...new Set([...TASK_CATEGORIES, ...fromTasks])];
  }, [store.tasks]);

  const open = store.tasks.filter((task) => task.status === 'open');
  const completed = store.tasks.filter((task) => task.status === 'done');

  const save = async () => {
    if (!draft || !draft.title.trim()) return;
    const values = {
      title: draft.title.trim(),
      category: draft.category,
      estimatedMinutes: draft.estimatedMinutes ? Number(draft.estimatedMinutes) : null,
      recurrence: draft.recurrence,
      windowDay: isValidIsoDate(draft.windowDay) ? draft.windowDay : null,
      windowStart: isValidTime(draft.windowStart) ? draft.windowStart : null,
      windowEnd: isValidTime(draft.windowEnd) ? draft.windowEnd : null,
    };
    if (draft.id) {
      await store.update(draft.id, values);
    } else {
      await store.add(values);
    }
    setDraft(null);
  };

  const edit = (task: Task) => {
    setDraft({
      id: task.id,
      title: task.title,
      category: task.category,
      estimatedMinutes: task.estimatedMinutes ? String(task.estimatedMinutes) : '',
      recurrence: task.recurrence,
      windowDay: task.windowDay ?? '',
      windowStart: task.windowStart ?? '',
      windowEnd: task.windowEnd ?? '',
    });
  };

  const renderTask = ({ item }: { item: Task }) => (
    <View className="mb-2 flex-row items-center gap-3 rounded-xl border border-border dark:border-border-dark bg-card dark:bg-card-dark p-3">
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          item.status === 'open' ? void store.complete(item.id) : void store.reopen(item.id)
        }
        className="active:opacity-60"
      >
        {item.status === 'done' ? (
          <CheckCircle2 size={22} color={uiColor('success', dark)} />
        ) : (
          <Circle size={22} color={uiColor('muted', dark)} />
        )}
      </Pressable>
      <Pressable className="flex-1 active:opacity-70" onPress={() => edit(item)}>
        <Body className={item.status === 'done' ? 'line-through opacity-50' : ''}>
          {item.title}
        </Body>
        <Muted style={TABULAR}>
          {t(`tasks.categories.${item.category}`, { defaultValue: item.category })}
          {item.recurrence !== 'none'
            ? ` · ${t(item.recurrence === 'daily' ? 'tasks.recurrenceDaily' : 'tasks.recurrenceWeekly')}`
            : ''}
          {item.windowDay ? ` · ${item.windowDay}` : ''}
          {item.windowStart ? ` ${item.windowStart}` : ''}
          {item.estimatedMinutes ? ` · ${item.estimatedMinutes} ${t('common.minutesShort')}` : ''}
          {item.weekId ? ` · ${t('tasks.fromWeekPlan')}` : ''}
        </Muted>
      </Pressable>
      <Pressable
        accessibilityRole="button"
        onPress={() => void store.remove(item.id)}
        className="p-1 active:opacity-60"
      >
        <Trash2 size={18} color={uiColor('danger', dark)} />
      </Pressable>
    </View>
  );

  return (
    <Screen scroll={false}>
      <View className="flex-row items-center justify-between">
        <Title>{t('tasks.title')}</Title>
        <Button
          title={t('tasks.new')}
          size="sm"
          icon={<Plus size={16} color={UI_COLORS.ink.light} />}
          onPress={() => setDraft({ ...emptyDraft })}
        />
      </View>

      {draft && (
        <Card className="mt-4">
          <SectionTitle>{draft.id ? t('tasks.edit') : t('tasks.new')}</SectionTitle>
          <View className="mt-3 gap-3">
            <Field
              label={t('tasks.taskTitle')}
              value={draft.title}
              onChangeText={(title) => setDraft({ ...draft, title })}
            />
            <View>
              <Label>{t('tasks.category')}</Label>
              <View className="flex-row flex-wrap gap-1.5">
                {categories.map((category) => {
                  const selected = draft.category === category;
                  return (
                    <Pressable
                      key={category}
                      onPress={() => setDraft({ ...draft, category })}
                      className={`rounded-full border-2 border-border dark:border-border-dark px-3 py-1 ${selected ? 'bg-highlight dark:bg-highlight-dark' : ''}`}
                    >
                      <Body
                        className={`text-sm ${selected ? 'font-bold text-ink' : ''}`}
                      >
                        {t(`tasks.categories.${category}`, { defaultValue: category })}
                      </Body>
                    </Pressable>
                  );
                })}
              </View>
            </View>
            <View className="flex-row gap-3">
              <Field
                className="flex-1"
                label={t('tasks.estimatedMinutes')}
                value={draft.estimatedMinutes}
                onChangeText={(estimatedMinutes) => setDraft({ ...draft, estimatedMinutes })}
                keyboardType="numeric"
                maxLength={3}
              />
              <View className="flex-1">
                <Label>{t('tasks.recurrence')}</Label>
                <SegmentedControl<Recurrence>
                  options={[
                    { value: 'none', label: t('tasks.recurrenceNone') },
                    { value: 'daily', label: t('tasks.recurrenceDaily') },
                    { value: 'weekly', label: t('tasks.recurrenceWeekly') },
                  ]}
                  value={draft.recurrence}
                  onChange={(recurrence) => setDraft({ ...draft, recurrence })}
                />
              </View>
            </View>
            <View>
              <Label>{t('tasks.window')}</Label>
              <View className="flex-row gap-3">
                <Field
                  className="flex-[1.4]"
                  label={t('tasks.windowDay')}
                  value={draft.windowDay}
                  onChangeText={(windowDay) => setDraft({ ...draft, windowDay })}
                  placeholder="YYYY-MM-DD"
                  autoCapitalize="none"
                  maxLength={10}
                />
                <TimeField
                  className="flex-1"
                  label={t('common.from')}
                  value={draft.windowStart}
                  onChange={(windowStart) => setDraft({ ...draft, windowStart })}
                />
                <TimeField
                  className="flex-1"
                  label={t('common.to')}
                  value={draft.windowEnd}
                  onChange={(windowEnd) => setDraft({ ...draft, windowEnd })}
                />
              </View>
            </View>
            <View className="flex-row justify-end gap-2">
              <Button title={t('common.cancel')} variant="secondary" onPress={() => setDraft(null)} />
              <Button title={t('common.save')} onPress={save} disabled={!draft.title.trim()} />
            </View>
          </View>
        </Card>
      )}

      <View className="mt-4 flex-1">
        {store.tasks.length === 0 ? (
          <Muted>{t('tasks.empty')}</Muted>
        ) : (
          <FlashList
            data={[...open, ...completed]}
            renderItem={renderTask}
            keyExtractor={(item) => String(item.id)}
            ListHeaderComponent={
              open.length > 0 ? (
                <SectionTitle style={TABULAR} className="mb-2">
                  {t('tasks.open')} ({open.length})
                </SectionTitle>
              ) : null
            }
          />
        )}
      </View>
    </Screen>
  );
}
