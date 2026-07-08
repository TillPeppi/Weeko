import { newId } from '../id';
import { fromRow, insertRow, nowIso, sb, selectRows, toRow } from '../sb';
import type { Task } from '../schema';

export async function listTasks(): Promise<Task[]> {
  return selectRows<Task>('task', (q) =>
    q
      .order('status', { ascending: true })
      .order('window_day', { ascending: true, nullsFirst: true })
      .order('created_at', { ascending: true })
  );
}

export async function listOpenTasks(): Promise<Task[]> {
  return selectRows<Task>('task', (q) =>
    q.eq('status', 'open').order('window_day', { ascending: true, nullsFirst: true })
  );
}

/** Open tasks relevant today: due today, without a day, or overdue. */
export async function listOpenTasksForDate(date: string): Promise<Task[]> {
  const todayOrUndated = await selectRows<Task>('task', (q) =>
    q
      .eq('status', 'open')
      .or(`window_day.is.null,window_day.eq.${date}`)
      .order('window_start', { ascending: true, nullsFirst: true })
  );
  const overdue = await selectRows<Task>('task', (q) =>
    q.eq('status', 'open').lt('window_day', date)
  );
  const seen = new Set(todayOrUndated.map((r) => r.id));
  return [...todayOrUndated, ...overdue.filter((t) => !seen.has(t.id))];
}

export async function createTask(values: {
  title: string;
  category: string;
  estimatedMinutes?: number | null;
  recurrence?: 'none' | 'daily' | 'weekly';
  windowDay?: string | null;
  windowStart?: string | null;
  windowEnd?: string | null;
  weekId?: string | null;
  blockId?: string | null;
}): Promise<string> {
  const id = newId();
  await insertRow('task', {
    id,
    title: values.title,
    category: values.category,
    estimatedMinutes: values.estimatedMinutes ?? null,
    recurrence: values.recurrence ?? 'none',
    windowDay: values.windowDay ?? null,
    windowStart: values.windowStart ?? null,
    windowEnd: values.windowEnd ?? null,
    weekId: values.weekId ?? null,
    blockId: values.blockId ?? null,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  return id;
}

/**
 * Completes a task. Recurring tasks spawn the next occurrence
 * (daily: +1 day, weekly: +7 days on the same weekday).
 */
export async function completeTask(id: string): Promise<void> {
  const { data, error } = await sb().from('task').select('*').eq('id', id).limit(1);
  if (error) throw error;
  const current = data && data[0] ? fromRow<Task>(data[0]) : undefined;
  if (!current) return;

  const upd = await sb()
    .from('task')
    .update(toRow({ status: 'done', completedAt: nowIso(), updatedAt: nowIso() }))
    .eq('id', id);
  if (upd.error) throw upd.error;

  if (current.recurrence !== 'none') {
    const baseDay = current.windowDay ?? new Date().toISOString().slice(0, 10);
    const nextDay = addDays(baseDay, current.recurrence === 'daily' ? 1 : 7);
    await insertRow('task', {
      id: newId(),
      title: current.title,
      category: current.category,
      estimatedMinutes: current.estimatedMinutes,
      recurrence: current.recurrence,
      windowDay: nextDay,
      windowStart: current.windowStart,
      windowEnd: current.windowEnd,
      context: current.context,
      createdAt: nowIso(),
      updatedAt: nowIso(),
    });
  }
}

export async function reopenTask(id: string): Promise<void> {
  const { error } = await sb()
    .from('task')
    .update(toRow({ status: 'open', completedAt: null, updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function updateTask(
  id: string,
  values: Partial<
    Pick<
      Task,
      | 'title'
      | 'category'
      | 'estimatedMinutes'
      | 'recurrence'
      | 'windowDay'
      | 'windowStart'
      | 'windowEnd'
    >
  >
): Promise<void> {
  const { error } = await sb()
    .from('task')
    .update(toRow({ ...values, updatedAt: nowIso() }))
    .eq('id', id);
  if (error) throw error;
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await sb().from('task').delete().eq('id', id);
  if (error) throw error;
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
