import { describe, it, expect } from 'vitest';
import { aggregateSeries } from './seriesAggregate';

describe('aggregateSeries', () => {
  it('day: passthrough, sorted ascending', () => {
    const out = aggregateSeries(
      [
        { date: '2024-01-03', value: 3 },
        { date: '2024-01-01', value: 1 },
      ],
      'day'
    );
    expect(out.map((b) => b.from)).toEqual(['2024-01-01', '2024-01-03']);
    expect(out.map((b) => b.value)).toEqual([1, 3]);
    expect(out.every((b) => b.count === 1)).toBe(true);
  });

  it('week: averages day-values within each ISO week', () => {
    // 2024-01-01 (Mon) & 2024-01-03 are ISO week 1; 2024-01-08 (Mon) is week 2
    const out = aggregateSeries(
      [
        { date: '2024-01-01', value: 10 },
        { date: '2024-01-03', value: 20 },
        { date: '2024-01-08', value: 5 },
      ],
      'week'
    );
    expect(out).toHaveLength(2);
    expect(out[0].value).toBe(15); // (10+20)/2
    expect(out[0].count).toBe(2);
    expect(out[0].from).toBe('2024-01-01'); // Monday of week 1
    expect(out[1].value).toBe(5);
    expect(out[1].from).toBe('2024-01-08');
  });

  it('month: averages by calendar month, ascending', () => {
    const out = aggregateSeries(
      [
        { date: '2024-02-10', value: 8 },
        { date: '2024-01-10', value: 2 },
        { date: '2024-01-20', value: 4 },
      ],
      'month'
    );
    expect(out.map((b) => b.from)).toEqual(['2024-01-01', '2024-02-01']);
    expect(out[0].value).toBe(3); // (2+4)/2
    expect(out[1].value).toBe(8);
  });

  it('empty input yields no buckets', () => {
    expect(aggregateSeries([], 'week')).toEqual([]);
  });
});
