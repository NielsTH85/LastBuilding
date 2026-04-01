import type { BuildSnapshot } from "@eob/build-model";

export interface StatDelta {
  statId: string;
  before: number;
  after: number;
  diff: number;
  percentDiff: number | null;
}

/**
 * Compute the difference between two snapshots.
 * Returns only stats that changed.
 */
export function computeDelta(before: BuildSnapshot, after: BuildSnapshot): StatDelta[] {
  const allStatIds = new Set([...Object.keys(before.stats), ...Object.keys(after.stats)]);
  const deltas: StatDelta[] = [];

  for (const statId of allStatIds) {
    const bVal = before.stats[statId] ?? 0;
    const aVal = after.stats[statId] ?? 0;
    const diff = aVal - bVal;

    if (Math.abs(diff) < 0.0001) continue;

    deltas.push({
      statId,
      before: bVal,
      after: aVal,
      diff,
      percentDiff: bVal !== 0 ? (diff / Math.abs(bVal)) * 100 : null,
    });
  }

  return deltas;
}
