import type { WeekImportParsed } from '@/schemas/week';
import type { BlockStatus } from '@/domain/types';
import { newId } from '../id';
import { fromRow, insertRow, insertRows, nowIso, sb, selectRows, toRow } from '../sb';
import { type Block, type Week, type WeekTemplate } from '../schema';

export interface WeekWithBlocks {
  week: Week;
  blocks: Block[];
}

export async function getWeek(year: number, isoWeek: number): Promise<Week | undefined> {
  const { data, error } = await sb()
    .from('week')
    .select('*')
    .eq('year', year)
    .eq('iso_week', isoWeek)
    .limit(1);
  if (error) throw error;
  return data && data[0] ? fromRow<Week>(data[0]) : undefined;
}

export async function getWeekWithBlocks(
  year: number,
  isoWeek: number
): Promise<WeekWithBlocks | undefined> {
  const found = await getWeek(year, isoWeek);
  if (!found) return undefined;
  const blocks = await selectRows<Block>('block', (q) =>
    q.eq('week_id', found.id).order('date', { ascending: true }).order('start', { ascending: true })
  );
  return { week: found, blocks };
}

/** The most recent `limit` weeks with their blocks, newest first — statistics. */
export async function listWeeksWithBlocks(limit = 12): Promise<WeekWithBlocks[]> {
  const weeks = await selectRows<Week>('week', (q) =>
    q.order('year', { ascending: false }).order('iso_week', { ascending: false }).limit(limit)
  );
  if (weeks.length === 0) return [];
  const blocks = await selectRows<Block>('block', (q) =>
    q
      .in(
        'week_id',
        weeks.map((w) => w.id)
      )
      .order('date', { ascending: true })
      .order('start', { ascending: true })
  );
  return weeks.map((w) => ({ week: w, blocks: blocks.filter((b) => b.weekId === w.id) }));
}

export async function getBlocksForDate(date: string): Promise<Block[]> {
  return selectRows<Block>('block', (q) => q.eq('date', date).order('start', { ascending: true }));
}

/**
 * Applies a validated import: replaces the target week (blocks + week-bound
 * tasks) or creates it. Caller must have confirmed the replacement. No client
 * transaction with PostgREST — steps run sequentially.
 */
export async function applyWeekImport(
  data: WeekImportParsed,
  source: 'imported' | 'template' = 'imported'
): Promise<string> {
  const existing = await getWeek(data.week.year, data.week.isoWeek);
  if (existing) {
    // remove week-bound tasks + blocks, then the week itself
    let res = await sb().from('task').delete().eq('week_id', existing.id);
    if (res.error) throw res.error;
    res = await sb().from('block').delete().eq('week_id', existing.id);
    if (res.error) throw res.error;
    res = await sb().from('week').delete().eq('id', existing.id);
    if (res.error) throw res.error;
  }

  const weekId = newId();
  await insertRow('week', {
    id: weekId,
    year: data.week.year,
    isoWeek: data.week.isoWeek,
    status: 'planned',
    source,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });

  const blocks = data.days.flatMap((day) =>
    day.blocks.map((b) => ({
      id: newId(),
      weekId,
      date: day.date,
      type: b.type,
      start: b.start,
      end: b.end,
      title: b.title,
      details: b.details ?? null,
      status: 'planned',
      updatedAt: nowIso(),
    }))
  );
  await insertRows('block', blocks);

  const tasks = (data.tasks ?? []).map((t) => ({
    id: newId(),
    title: t.title,
    category: t.category,
    estimatedMinutes: t.estimatedMinutes ?? null,
    windowDay: t.preferredWindow?.day ?? null,
    windowStart: t.preferredWindow?.start ?? null,
    windowEnd: t.preferredWindow?.end ?? null,
    context: t.context ?? null,
    weekId,
    createdAt: nowIso(),
    updatedAt: nowIso(),
  }));
  await insertRows('task', tasks);

  return weekId;
}

export async function setBlockStatus(blockId: string, status: BlockStatus): Promise<void> {
  const { error } = await sb()
    .from('block')
    .update(toRow({ status, updatedAt: nowIso() }))
    .eq('id', blockId);
  if (error) throw error;
}

export async function updateBlock(
  blockId: string,
  values: Partial<Pick<Block, 'start' | 'end' | 'title' | 'type' | 'date' | 'details'>>
): Promise<void> {
  const { error } = await sb()
    .from('block')
    .update(toRow({ ...values, updatedAt: nowIso() }))
    .eq('id', blockId);
  if (error) throw error;
}

export async function deleteBlock(blockId: string): Promise<void> {
  const { error } = await sb().from('block').delete().eq('id', blockId);
  if (error) throw error;
}

// --- Week templates -------------------------------------------------------

/**
 * Stores the current week as a template. Dates are normalized to ISO weekday
 * numbers so the template can be instantiated in any week.
 */
export async function saveWeekAsTemplate(name: string, source: WeekWithBlocks): Promise<void> {
  const byDate = new Map<string, typeof source.blocks>();
  for (const b of source.blocks) {
    const list = byDate.get(b.date) ?? [];
    list.push(b);
    byDate.set(b.date, list);
  }
  const days = [...byDate.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, blocks]) => ({
      weekday: isoWeekdayOf(date),
      blocks: blocks.map((b) => ({
        type: b.type,
        start: b.start,
        end: b.end,
        title: b.title,
        details: b.details ?? undefined,
      })),
    }));
  await insertRow('week_template', {
    id: newId(),
    name,
    data: { days },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
}

function isoWeekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00`).getDay();
  return d === 0 ? 7 : d;
}

export async function listWeekTemplates(): Promise<WeekTemplate[]> {
  return selectRows<WeekTemplate>('week_template', (q) => q.order('name', { ascending: true }));
}

export async function deleteWeekTemplate(id: string): Promise<void> {
  const { error } = await sb().from('week_template').delete().eq('id', id);
  if (error) throw error;
}

interface TemplateDay {
  weekday: number;
  blocks: {
    type: Block['type'];
    start: string;
    end: string;
    title: string;
    details?: Record<string, unknown>;
  }[];
}

/** Instantiates a template into a concrete week (mondayDate = YYYY-MM-DD of that week's Monday). */
export function templateToImport(
  template: WeekTemplate,
  target: { year: number; isoWeek: number; mondayDate: string }
): WeekImportParsed {
  const days = ((template.data as { days?: TemplateDay[] }).days ?? []).map((day) => ({
    date: addDaysIsoLocal(target.mondayDate, day.weekday - 1),
    blocks: day.blocks,
  }));
  return {
    schemaVersion: 1,
    week: { year: target.year, isoWeek: target.isoWeek },
    days,
    tasks: [],
  };
}

function addDaysIsoLocal(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00`);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}
