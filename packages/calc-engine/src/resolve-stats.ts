import type { AggregatedStat } from "./aggregate.js";

export interface ResolvedStat {
  statId: string;
  base: number;
  added: number;
  increased: number;
  more: number;
  final: number;
}

/**
 * Resolve a single stat through the modifier pipeline:
 * 1. Set base (if a "set" modifier is present, use it; otherwise 0)
 * 2. Sum all "add" modifiers → base + Σ(add)
 * 3. Apply increased/decreased: × (1 + Σ(increased) / 100)
 * 4. Apply more/less multipliers: × Π(1 + more / 100)
 * 5. Override (if present, replaces final)
 */
export function resolveStat(agg: AggregatedStat): ResolvedStat {
  // Base from "set" modifier, or 0
  const base = agg.setMod ? agg.setMod.value : 0;

  // Sum additive
  const added = agg.addMods.reduce((sum, m) => sum + m.value, 0);

  // Sum increased percentage
  const increased = agg.increasedMods.reduce((sum, m) => sum + m.value, 0);

  // Multiply more/less
  let moreMultiplier = 1;
  for (const m of agg.moreMods) {
    moreMultiplier *= 1 + m.value / 100;
  }

  const afterAdd = base + added;
  const afterIncreased = afterAdd * (1 + increased / 100);
  const afterMore = afterIncreased * moreMultiplier;

  // Override replaces everything
  const final = agg.overrideMod ? agg.overrideMod.value : afterMore;

  return {
    statId: agg.statId,
    base,
    added,
    increased,
    more: (moreMultiplier - 1) * 100,
    final,
  };
}

/**
 * Resolve all aggregated stats.
 */
export function resolveAllStats(aggregated: Map<string, AggregatedStat>): Map<string, ResolvedStat> {
  const results = new Map<string, ResolvedStat>();
  for (const [statId, agg] of aggregated) {
    results.set(statId, resolveStat(agg));
  }
  return results;
}
