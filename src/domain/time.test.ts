import { describe, expect, it } from 'vitest';
import {
  addDaysIso,
  durationMinutes,
  isValidIsoDate,
  isValidTime,
  isWithin,
  isoWeekOf,
  isoWeekday,
  timesOverlap,
  toMinutes,
  toTimeString,
} from './time';

describe('time helpers', () => {
  it('validates HH:mm times', () => {
    expect(isValidTime('07:30')).toBe(true);
    expect(isValidTime('00:00')).toBe(true);
    expect(isValidTime('24:00')).toBe(true);
    expect(isValidTime('24:01')).toBe(false);
    expect(isValidTime('7:30')).toBe(false);
    expect(isValidTime('25:00')).toBe(false);
    expect(isValidTime('12:60')).toBe(false);
  });

  it('converts between minutes and time strings', () => {
    expect(toMinutes('07:30')).toBe(450);
    expect(toMinutes('24:00')).toBe(1440);
    expect(toTimeString(450)).toBe('07:30');
    expect(toTimeString(1440)).toBe('24:00');
  });

  it('validates ISO dates including impossible ones', () => {
    expect(isValidIsoDate('2026-07-06')).toBe(true);
    expect(isValidIsoDate('2026-02-30')).toBe(false);
    expect(isValidIsoDate('2026-13-01')).toBe(false);
    expect(isValidIsoDate('06.07.2026')).toBe(false);
  });

  it('computes ISO weekday and week', () => {
    expect(isoWeekday('2026-07-06')).toBe(1); // Monday
    expect(isoWeekday('2026-07-12')).toBe(7); // Sunday
    expect(isoWeekOf('2026-07-06')).toEqual({ year: 2026, isoWeek: 28 });
    // ISO year boundary: 2027-01-01 is a Friday in ISO week 53 of 2026
    expect(isoWeekOf('2027-01-01')).toEqual({ year: 2026, isoWeek: 53 });
  });

  it('adds days across month boundaries', () => {
    expect(addDaysIso('2026-07-31', 1)).toBe('2026-08-01');
    expect(addDaysIso('2026-07-06', -1)).toBe('2026-07-05');
  });

  it('computes durations and overlap', () => {
    expect(durationMinutes('07:30', '17:00')).toBe(570);
    expect(timesOverlap('08:00', '10:00', '09:00', '11:00')).toBe(true);
    expect(timesOverlap('08:00', '10:00', '10:00', '11:00')).toBe(false); // touching is fine
    expect(isWithin('09:00', '08:00', '10:00')).toBe(true);
    expect(isWithin('10:00', '08:00', '10:00')).toBe(false);
  });
});

describe('formatClock', () => {
  it('formats seconds as m:ss below an hour and h:mm:ss above', async () => {
    const { formatClock } = await import('./time');
    expect(formatClock(0)).toBe('0:00');
    expect(formatClock(95)).toBe('1:35');
    expect(formatClock(3600)).toBe('1:00:00');
    expect(formatClock(3725)).toBe('1:02:05');
    expect(formatClock(-5)).toBe('0:00');
  });
});
