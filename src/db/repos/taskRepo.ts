import { and, asc, eq, isNull, or } from 'drizzle-orm';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { task, type Task } from '../schema';

export async function listTasks(): Promise<Task[]> {
  return db.select().from(task).orderBy(asc(task.status), asc(task.windowDay), asc(task.createdAt));
}

export async function listOpenTasks(): Promise<Task[]> {
  return db.select().from(task).where(eq(task.status, 'open')).orderBy(asc(task.windowDay));
}

/** Open tasks relevant today: due today, without a day, or overdue. */
export async function listOpenTasksForDate(date: string): Promise<Task[]> {
  const rows = await db
    .select()
    .from(task)
    .where(and(eq(task.status, 'open'), or(isNull(task.windowDay), eq(task.windowDay, date))))
    .orderBy(asc(task.windowStart));
  const overdue = await db.select().from(task).where(eq(task.status, 'open'));
  const overdueFiltered = overdue.filter((t) => t.windowDay !== null && t.windowDay < date);
  const seen = new Set(rows.map((r) => r.id));
  return [...rows, ...overdueFiltered.filter((t) => !seen.has(t.id))];
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
  await db.insert(task).values({
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
    ...auditInsert(),
  });
  return id;
}

/**
 * Completes a task. Recurring tasks spawn the next occurrence
 * (daily: +1 day, weekly: +7 days on the same weekday).
 */
export async function completeTask(id: string): Promise<void> {
  const rows = await db.select().from(task).where(eq(task.id, id));
  const current = rows[0];
  if (!current) return;
  await db.update(task).set({ status: 'done', completedAt: nowIso() }).where(eq(task.id, id));

  if (current.recurrence !== 'none') {
    const baseDay = current.windowDay ?? new Date().toISOString().slice(0, 10);
    const nextDay = addDays(baseDay, current.recurrence === 'daily' ? 1 : 7);
    await db.insert(task).values({
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
      ...auditInsert(),
    });
  }
}

export async function reopenTask(id: string): Promise<void> {
  await db.update(task).set({ status: 'open', completedAt: null }).where(eq(task.id, id));
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
  await db.update(task).set(values).where(eq(task.id, id));
}

export async function deleteTask(id: string): Promise<void> {
  await db.delete(task).where(eq(task.id, id));
}

function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
