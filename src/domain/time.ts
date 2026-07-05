/**
 * Pure time/date helpers. "HH:mm" strings and "YYYY-MM-DD" ISO dates.
 * 24:00 is allowed as an end-of-day boundary (= 1440 minutes).
 */
import { addDays as dfAddDays, format, getISOWeek, getISOWeekYear, parseISO } from 'date-fns';

export const TIME_RE = /^(?:([01]\d|2[0-3]):([0-5]\d)|24:00)$/;
export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

export const DAY_START_MIN = 5 * 60; // 05:00
export const DAY_END_MIN = 24 * 60; // 24:00

export function isValidTime(value: string): boolean {
  return TIME_RE.test(value);
}

/** "07:30" -> 450. "24:00" -> 1440. Throws on invalid input. */
export function toMinutes(time: string): number {
  if (!isValidTime(time)) throw new Error(`Invalid time: ${time}`);
  const [h, m] = time.split(':').map(Number);
  return h * 60 + m;
}

/** 450 -> "07:30" */
export function toTimeString(minutes: number): string {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

export function isValidIsoDate(value: string): boolean {
  if (!DATE_RE.test(value)) return false;
  const parsed = parseISO(value);
  return !Number.isNaN(parsed.getTime()) && format(parsed, 'yyyy-MM-dd') === value;
}

export function addDaysIso(date: string, days: number): string {
  return format(dfAddDays(parseISO(date), days), 'yyyy-MM-dd');
}

/** ISO weekday: 1 = Monday … 7 = Sunday */
export function isoWeekday(date: string): number {
  const d = parseISO(date).getDay();
  return d === 0 ? 7 : d;
}

export function isoWeekOf(date: string): { year: number; isoWeek: number } {
  const parsed = parseISO(date);
  return { year: getISOWeekYear(parsed), isoWeek: getISOWeek(parsed) };
}

/** Monday (YYYY-MM-DD) of the ISO week containing `date`. */
export function mondayOfWeek(date: string): string {
  return addDaysIso(date, 1 - isoWeekday(date));
}

export interface IsoWeekRef {
  year: number;
  isoWeek: number;
  /** Monday of that week, YYYY-MM-DD */
  monday: string;
}

/** The last `count` ISO weeks including the week of `today`, oldest first. */
export function recentIsoWeeks(today: string, count: number): IsoWeekRef[] {
  const weeks: IsoWeekRef[] = [];
  for (let i = count - 1; i >= 0; i -= 1) {
    const monday = mondayOfWeek(addDaysIso(today, -7 * i));
    weeks.push({ ...isoWeekOf(monday), monday });
  }
  return weeks;
}

/** Duration in minutes between two HH:mm times (end after start assumed). */
export function durationMinutes(start: string, end: string): number {
  return toMinutes(end) - toMinutes(start);
}

/** Half-open interval overlap: [aStart, aEnd) vs [bStart, bEnd). */
export function timesOverlap(aStart: string, aEnd: string, bStart: string, bEnd: string): boolean {
  return toMinutes(aStart) < toMinutes(bEnd) && toMinutes(bStart) < toMinutes(aEnd);
}

/** Is `time` inside [start, end)? Used for "current block" lookups. */
export function isWithin(time: string, start: string, end: string): boolean {
  const t = toMinutes(time);
  return t >= toMinutes(start) && t < toMinutes(end);
}

/** Seconds → live-timer format: "m:ss" below an hour, "h:mm:ss" above. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = String(s % 60).padStart(2, '0');
  return h > 0 ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
}
