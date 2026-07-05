/**
 * Pure superset helpers (framework-free, §6.5).
 *
 * A superset groups two or more exercises that are performed back-to-back with
 * rest only after the last exercise of the group. Grouping lives on each set
 * (`set_log.supersetGroup`); all sets of an exercise within a session share the
 * same value. Group ids are opaque integers, unique per session — this module
 * only cares about which ids are equal.
 */

export interface SupersetSlot {
  /** letter label (A, B, …) when this exercise is part of a superset; null when standalone */
  label: string | null;
  /** true when standalone OR the last exercise of its group → checking a set here starts the rest */
  isLastInGroup: boolean;
  /** number of exercises sharing this group (1 when standalone) */
  groupSize: number;
}

/**
 * Derives per-exercise superset info from the exercises' group ids, in display
 * order. Groups with fewer than two members are treated as standalone (a
 * superset of one is meaningless). Letters are assigned in order of first
 * appearance of each real (size ≥ 2) group.
 */
export function supersetView(groupIds: readonly (number | null)[]): SupersetSlot[] {
  const counts = new Map<number, number>();
  for (const g of groupIds) {
    if (g !== null) counts.set(g, (counts.get(g) ?? 0) + 1);
  }

  const isReal = (g: number | null): g is number => g !== null && (counts.get(g) ?? 0) >= 2;

  const letters = new Map<number, string>();
  let next = 0;
  for (const g of groupIds) {
    if (isReal(g) && !letters.has(g)) {
      letters.set(g, String.fromCharCode(65 + (next % 26)));
      next += 1;
    }
  }

  return groupIds.map((g, i) => {
    if (!isReal(g)) return { label: null, isLastInGroup: true, groupSize: 1 };
    const isLastInGroup = !groupIds.some((other, j) => j > i && other === g);
    return { label: letters.get(g) ?? '?', isLastInGroup, groupSize: counts.get(g) ?? 1 };
  });
}

/** Next free superset group id for a session, given the ids currently in use. */
export function nextSupersetGroup(groupIds: readonly (number | null)[]): number {
  let max = 0;
  for (const g of groupIds) {
    if (g !== null && g > max) max = g;
  }
  return max + 1;
}
