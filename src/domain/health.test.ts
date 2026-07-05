import { describe, expect, it } from 'vitest';
import { SLEEP_VALUE, summarizeSleep, type SleepSample } from './health';

const sample = (
  start: string,
  end: string,
  value: number,
  sourceId = 'com.apple.health',
  sourceName = 'Apple Watch'
): SleepSample => ({ start, end, value, sourceId, sourceName });

describe('summarizeSleep', () => {
  it('sums stages, derives totals and bed/wake times', () => {
    const summary = summarizeSleep([
      sample('2026-07-02T22:30:00Z', '2026-07-03T06:30:00Z', SLEEP_VALUE.inBed),
      sample('2026-07-02T22:45:00Z', '2026-07-03T02:45:00Z', SLEEP_VALUE.asleepCore),
      sample('2026-07-03T02:45:00Z', '2026-07-03T03:45:00Z', SLEEP_VALUE.asleepDeep),
      sample('2026-07-03T03:45:00Z', '2026-07-03T05:15:00Z', SLEEP_VALUE.asleepREM),
      sample('2026-07-03T05:15:00Z', '2026-07-03T05:30:00Z', SLEEP_VALUE.awake),
      sample('2026-07-03T05:30:00Z', '2026-07-03T06:15:00Z', SLEEP_VALUE.asleepCore),
    ]);
    expect(summary).not.toBeNull();
    expect(summary!.coreMinutes).toBe(285); // 240 + 45
    expect(summary!.deepMinutes).toBe(60);
    expect(summary!.remMinutes).toBe(90);
    expect(summary!.awakeMinutes).toBe(15);
    expect(summary!.asleepMinutes).toBe(435);
    expect(summary!.inBedMinutes).toBe(480);
    expect(summary!.bedtime).toBe('2026-07-02T22:30:00Z');
    expect(summary!.wakeTime).toBe('2026-07-03T06:30:00Z');
    expect(summary!.sourceName).toBe('Apple Watch');
  });

  it('does not double count when watch and ring both recorded — picks the richer source', () => {
    const summary = summarizeSleep([
      // watch: only 2 h recorded (taken off at night)
      sample('2026-07-03T00:00:00Z', '2026-07-03T02:00:00Z', SLEEP_VALUE.asleepCore),
      // ring (Zepp): full night
      sample('2026-07-02T23:00:00Z', '2026-07-03T05:00:00Z', SLEEP_VALUE.asleepCore, 'com.zepp', 'Zepp'),
      sample('2026-07-03T05:00:00Z', '2026-07-03T06:00:00Z', SLEEP_VALUE.asleepDeep, 'com.zepp', 'Zepp'),
    ]);
    expect(summary!.asleepMinutes).toBe(420); // ring only, not 420 + 120
    expect(summary!.sourceName).toBe('Zepp');
  });

  it('handles old-style data with only inBed samples', () => {
    const summary = summarizeSleep([
      sample('2026-07-02T23:00:00Z', '2026-07-03T07:00:00Z', SLEEP_VALUE.inBed),
    ]);
    expect(summary!.asleepMinutes).toBe(0);
    expect(summary!.inBedMinutes).toBe(480);
  });

  it('returns null without usable data', () => {
    expect(summarizeSleep([])).toBeNull();
    expect(
      summarizeSleep([sample('2026-07-03T05:00:00Z', '2026-07-03T05:10:00Z', SLEEP_VALUE.awake)])
    ).toBeNull();
  });
});
