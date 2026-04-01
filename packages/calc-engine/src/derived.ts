import type { ResolvedStat } from "./resolve-stats.js";

/**
 * Derived stat definitions.
 * Each entry maps a derived stat to a function that computes it
 * from the resolved stats map.
 */
type DerivedStatFn = (stats: Map<string, ResolvedStat>) => number;

function getStat(stats: Map<string, ResolvedStat>, id: string): number {
  return stats.get(id)?.final ?? 0;
}

const DERIVED_STATS: [string, DerivedStatFn][] = [
  // Health: base + vitality * 10
  [
    "health",
    (stats) => {
      const baseHealth = getStat(stats, "health");
      const vitality = getStat(stats, "vitality");
      return baseHealth + vitality * 10;
    },
  ],

  // Effective health: health + ward
  [
    "effective_health",
    (stats) => {
      const health = getStat(stats, "health");
      const ward = getStat(stats, "ward");
      return health + ward;
    },
  ],

  // Average hit: spell_damage * (1 + crit_chance/100 * (crit_multiplier/100 - 1))
  [
    "average_hit",
    (stats) => {
      const spellDmg = getStat(stats, "spell_damage");
      const critChance = Math.min(getStat(stats, "crit_chance"), 100) / 100;
      const critMulti = getStat(stats, "crit_multiplier") / 100;
      // Base damage is affected by increased/more spell damage
      // For simplicity in MVP, use raw spell_damage as base
      const baseDmg = spellDmg > 0 ? spellDmg : 100; // default 100 base
      return baseDmg * (1 + critChance * (critMulti - 1));
    },
  ],

  // Expected DPS: average_hit * cast_speed_attacks_per_sec
  [
    "expected_dps",
    (stats) => {
      const avgHit = getStat(stats, "average_hit");
      const castSpeed = getStat(stats, "cast_speed");
      // Cast speed as attacks/casts per second (base 1.0, +% adds)
      const castsPerSec = 1 * (1 + castSpeed / 100);
      return avgHit * castsPerSec;
    },
  ],
];

/**
 * Compute derived stats and merge them back into the stats map.
 * Runs in dependency order (health before effective_health, etc.).
 */
export function computeDerivedStats(stats: Map<string, ResolvedStat>): void {
  for (const [statId, fn] of DERIVED_STATS) {
    const value = fn(stats);
    const existing = stats.get(statId);
    if (existing) {
      // Update the final value with derived computation
      stats.set(statId, { ...existing, final: value });
    } else {
      stats.set(statId, {
        statId,
        base: 0,
        added: 0,
        increased: 0,
        more: 0,
        final: value,
      });
    }
  }
}
