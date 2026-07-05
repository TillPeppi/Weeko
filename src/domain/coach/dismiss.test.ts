import { describe, expect, it } from 'vitest';
import type { Insight } from './insights';
import { dismissUntil, filterActiveInsights, isDismissed, type Dismissal } from './dismiss';

const NOW_ISO = '2026-07-08T09:00:00.000Z';
const NOW_MS = Date.parse(NOW_ISO);

const insight = (partial: Partial<Insight> = {}): Insight => ({
  id: 'i1',
  kind: 'suggestion',
  category: 'nutrition',
  key: 'coach.insights.x',
  params: {},
  score: 50,
  ...partial,
});

describe('isDismissed', () => {
  it('is false when there is no dismissal', () => {
    expect(isDismissed('i1', [], NOW_ISO)).toBe(false);
  });

  it('treats until=null as permanently dismissed', () => {
    const d: Dismissal[] = [{ id: 'i1', until: null }];
    expect(isDismissed('i1', d, NOW_ISO)).toBe(true);
  });

  it('hides while inside the snooze window and reappears after', () => {
    const d: Dismissal[] = [{ id: 'i1', until: '2026-07-08T12:00:00.000Z' }];
    expect(isDismissed('i1', d, NOW_ISO)).toBe(true); // 09:00 < 12:00
    expect(isDismissed('i1', d, '2026-07-08T12:00:01.000Z')).toBe(false);
  });
});

describe('filterActiveInsights', () => {
  it('drops dismissed, keeps the rest', () => {
    const insights = [insight({ id: 'a' }), insight({ id: 'b' }), insight({ id: 'c' })];
    const dismissals: Dismissal[] = [
      { id: 'a', until: null },
      { id: 'b', until: '2026-07-08T12:00:00.000Z' }, // still snoozed
    ];
    expect(filterActiveInsights(insights, dismissals, NOW_ISO).map((i) => i.id)).toEqual(['c']);
  });
});

describe('dismissUntil', () => {
  it('returns null for informational insights (permanent dismiss)', () => {
    expect(dismissUntil(insight(), NOW_MS)).toBeNull();
  });

  it('returns a snooze deadline for actionable insights', () => {
    const result = dismissUntil(insight({ snoozeMinutes: 180 }), NOW_MS);
    expect(result).toBe('2026-07-08T12:00:00.000Z'); // +3h
  });

  it('uses the configured snooze override when given', () => {
    const result = dismissUntil(insight({ snoozeMinutes: 180 }), NOW_MS, 60);
    expect(result).toBe('2026-07-08T10:00:00.000Z'); // +1h override
  });

  it('ignores the override for informational insights (stays permanent)', () => {
    expect(dismissUntil(insight(), NOW_MS, 60)).toBeNull();
  });
});
