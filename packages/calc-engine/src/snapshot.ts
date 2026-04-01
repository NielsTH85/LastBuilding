import type {
  BuildSnapshot,
  OffensiveSummary,
  DefensiveSummary,
  SustainSummary,
  StatBreakdown,
} from "@eob/build-model";
import type { ResolvedStat } from "./resolve-stats.js";
import type { AggregatedStat } from "./aggregate.js";

function getFinal(stats: Map<string, ResolvedStat>, id: string): number {
  return stats.get(id)?.final ?? 0;
}

/**
 * Build an immutable snapshot from resolved stats and aggregated modifiers.
 */
export function buildSnapshot(
  resolved: Map<string, ResolvedStat>,
  aggregated: Map<string, AggregatedStat>,
): BuildSnapshot {
  const stats: Record<string, number> = {};
  for (const [id, r] of resolved) {
    stats[id] = r.final;
  }

  const offensive: OffensiveSummary = {
    averageHit: getFinal(resolved, "average_hit"),
    critChance: getFinal(resolved, "crit_chance"),
    critMultiplier: getFinal(resolved, "crit_multiplier"),
    castSpeed: getFinal(resolved, "cast_speed"),
    attackSpeed: getFinal(resolved, "attack_speed"),
    expectedDps: getFinal(resolved, "expected_dps"),
    spellDamage: getFinal(resolved, "spell_damage"),
    increasedSpellDamage: getFinal(resolved, "increased_spell_damage"),
    increasedElementalDamage: getFinal(resolved, "increased_elemental_damage"),
  };

  const defensive: DefensiveSummary = {
    health: getFinal(resolved, "health"),
    ward: getFinal(resolved, "ward"),
    armor: getFinal(resolved, "armor"),
    dodgeRating: getFinal(resolved, "dodge_rating"),
    blockChance: getFinal(resolved, "block_chance"),
    endurance: getFinal(resolved, "endurance"),
    fireResistance: getFinal(resolved, "fire_resistance"),
    coldResistance: getFinal(resolved, "cold_resistance"),
    lightningResistance: getFinal(resolved, "lightning_resistance"),
    necroticResistance: getFinal(resolved, "necrotic_resistance"),
    voidResistance: getFinal(resolved, "void_resistance"),
    poisonResistance: getFinal(resolved, "poison_resistance"),
    effectiveHealth: getFinal(resolved, "effective_health"),
  };

  const sustain: SustainSummary = {
    mana: getFinal(resolved, "mana"),
    manaRegen: getFinal(resolved, "mana_regen"),
    healthRegen: getFinal(resolved, "health_regen"),
    wardRetention: getFinal(resolved, "ward_retention"),
    movementSpeed: getFinal(resolved, "movement_speed"),
  };

  // Build source breakdowns
  const breakdowns: StatBreakdown[] = [];
  for (const [statId, r] of resolved) {
    const agg = aggregated.get(statId);
    const sources = agg
      ? [...agg.addMods, ...agg.increasedMods, ...agg.moreMods].map((m) => ({
          sourceType: m.sourceType,
          sourceId: m.sourceId,
          sourceName: m.id,
          operation: m.operation,
          value: m.value,
        }))
      : [];

    breakdowns.push({
      statId: statId as StatBreakdown["statId"],
      base: r.base,
      added: r.added,
      increased: r.increased,
      more: r.more,
      final: r.final,
      sources,
    });
  }

  return { stats, offensive, defensive, sustain, breakdowns };
}
