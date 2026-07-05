import { and, asc, desc, eq, inArray } from 'drizzle-orm';
import type { WeekImportParsed } from '@/schemas/week';
import type { BlockStatus } from '@/domain/types';
import { db, nowIso } from '../client';
import { newId } from '../id';
import { auditInsert } from '../audit';
import { block, task, week, weekTemplate, type Block, type Week, type WeekTemplate } from '../schema';

export interface WeekWithBlocks {
  week: Week;
  blocks: Block[];
}

export async function getWeek(year: number, isoWeek: number): Promise<Week | undefined> {
  const rows = await db
    .select()
    .from(week)
    .where(and(eq(week.year, year), eq(week.isoWeek, isoWeek)));
  return rows[0];
}

export async function getWeekWithBlocks(
  year: number,
  isoWeek: number
): Promise<WeekWithBlocks | undefined> {
  const found = await getWeek(year, isoWeek);
  if (!found) return undefined;
  const blocks = await db
    .select()
    .from(block)
    .where(eq(block.weekId, found.id))
    .orderBy(asc(block.date), asc(block.start));
  return { week: found, blocks };
}

/** The most recent `limit` weeks with their blocks, newest first — statistics. */
export async function listWeeksWithBlocks(limit = 12): Promise<WeekWithBlocks[]> {
  const weeks = await db
    .select()
    .from(week)
    .orderBy(desc(week.year), desc(week.isoWeek))
    .limit(limit);
  if (weeks.length === 0) return [];
  const blocks = await db
    .select()
    .from(block)
    .where(inArray(block.weekId, weeks.map((w) => w.id)))
    .orderBy(asc(block.date), asc(block.start));
  return weeks.map((w) => ({ week: w, blocks: blocks.filter((b) => b.weekId === w.id) }));
}

export async function getBlocksForDate(date: string): Promise<Block[]> {
  return db.select().from(block).where(eq(block.date, date)).orderBy(asc(block.start));
}

/**
 * Applies a validated import: replaces the target week (blocks + week-bound
 * tasks) or creates it. Caller must have confirmed the replacement.
 */
export async function applyWeekImport(
  data: WeekImportParsed,
  source: 'imported' | 'template' = 'imported'
): Promise<string> {
  return db.transaction(async (tx) => {
    const existing = await tx
      .select()
      .from(week)
      .where(and(eq(week.year, data.week.year), eq(week.isoWeek, data.week.isoWeek)));

    if (existing[0]) {
      // blocks cascade via FK; week-bound tasks are replaced by the import
      await tx.delete(task).where(eq(task.weekId, existing[0].id));
      await tx.delete(week).where(eq(week.id, existing[0].id));
    }

    const weekId = newId();
    await tx.insert(week).values({
      id: weekId,
      year: data.week.year,
      isoWeek: data.week.isoWeek,
      status: 'planned',
      source,
      createdAt: nowIso(),
      ...auditInsert(),
    });

    for (const day of data.days) {
      for (const b of day.blocks) {
        await tx.insert(block).values({
          id: newId(),
          weekId,
          date: day.date,
          type: b.type,
          start: b.start,
          end: b.end,
          title: b.title,
          details: b.details ?? null,
          status: 'planned',
          ...auditInsert(),
        });
      }
    }

    for (const t of data.tasks ?? []) {
      await tx.insert(task).values({
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
        ...auditInsert(),
      });
    }

    return weekId;
  });
}

export async function setBlockStatus(blockId: string, status: BlockStatus): Promise<void> {
  await db.update(block).set({ status }).where(eq(block.id, blockId));
}

export async function updateBlock(
  blockId: string,
  values: Partial<Pick<Block, 'start' | 'end' | 'title' | 'type' | 'date' | 'details'>>
): Promise<void> {
  await db.update(block).set(values).where(eq(block.id, blockId));
}

export async function deleteBlock(blockId: string): Promise<void> {
  await db.delete(block).where(eq(block.id, blockId));
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
      // store ISO weekday (1–7) instead of a concrete date
      weekday: isoWeekdayOf(date),
      blocks: blocks.map((b) => ({
        type: b.type,
        start: b.start,
        end: b.end,
        title: b.title,
        details: b.details ?? undefined,
      })),
    }));
  await db
    .insert(weekTemplate)
    .values({ id: newId(), name, data: { days }, createdAt: nowIso(), ...auditInsert() });
}

function isoWeekdayOf(date: string): number {
  const d = new Date(`${date}T12:00:00`).getDay();
  return d === 0 ? 7 : d;
}

export async function listWeekTemplates(): Promise<WeekTemplate[]> {
  return db.select().from(weekTemplate).orderBy(asc(weekTemplate.name));
}

export async function deleteWeekTemplate(id: string): Promise<void> {
  await db.delete(weekTemplate).where(eq(weekTemplate.id, id));
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
