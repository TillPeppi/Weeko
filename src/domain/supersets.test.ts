import { describe, expect, it } from 'vitest';
import { nextSupersetGroup, supersetView } from './supersets';

describe('supersetView', () => {
  it('treats all-standalone exercises as such', () => {
    const view = supersetView([null, null, null]);
    expect(view).toEqual([
      { label: null, isLastInGroup: true, groupSize: 1 },
      { label: null, isLastInGroup: true, groupSize: 1 },
      { label: null, isLastInGroup: true, groupSize: 1 },
    ]);
  });

  it('labels a group of two and marks only the last as rest-trigger', () => {
    const view = supersetView([1, 1]);
    expect(view[0]).toEqual({ label: 'A', isLastInGroup: false, groupSize: 2 });
    expect(view[1]).toEqual({ label: 'A', isLastInGroup: true, groupSize: 2 });
  });

  it('ignores a singleton group (superset of one is meaningless)', () => {
    const view = supersetView([5, null]);
    expect(view[0]).toEqual({ label: null, isLastInGroup: true, groupSize: 1 });
  });

  it('assigns letters in order of first appearance and supports three members', () => {
    // group 2 appears first, then group 1 (a run of three)
    const view = supersetView([2, 2, null, 1, 1, 1]);
    expect(view.map((s) => s.label)).toEqual(['A', 'A', null, 'B', 'B', 'B']);
    expect(view.map((s) => s.isLastInGroup)).toEqual([false, true, true, false, false, true]);
    expect(view[3].groupSize).toBe(3);
  });
});

describe('nextSupersetGroup', () => {
  it('starts at 1 when nothing is grouped', () => {
    expect(nextSupersetGroup([null, null])).toBe(1);
  });

  it('returns max + 1 of the ids in use', () => {
    expect(nextSupersetGroup([1, null, 3, 2])).toBe(4);
  });
});
