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
    armorDamageReduction: getFinal(resolved, "armor_damage_reduction"),
    dodgeRating: getFinal(resolved, "dodge_rating"),
    dodgeChance: getFinal(resolved, "dodge_chance"),
    blockChance: getFinal(resolved, "block_chance"),
    blockEffectiveness: getFinal(resolved, "block_effectiveness"),
    blockDamageReduction: getFinal(resolved, "block_damage_reduction"),
    glancingBlowChance: getFinal(resolved, "glancing_blow_chance"),
    glancingBlowDamageReduction: getFinal(resolved, "glancing_blow_damage_reduction"),
    endurance: getFinal(resolved, "endurance"),
    enduranceThreshold: getFinal(resolved, "endurance_threshold"),
    lessDamageTaken: getFinal(resolved, "total_less_damage_taken"),
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
    manaCostPerSecond: getFinal(resolved, "mana_cost_per_second"),
    manaNetPerSecond: getFinal(resolved, "mana_net_per_second"),
    timeToOomSeconds: getFinal(resolved, "time_to_oom_seconds"),
    skillUsesPerSecond: getFinal(resolved, "skill_uses_per_second"),
    effectiveSkillCooldown: getFinal(resolved, "effective_skill_cooldown"),
    healthLeechPerSecond: getFinal(resolved, "health_leech_per_second"),
    wardPerSecond: getFinal(resolved, "ward_per_second"),
    wardGainedPerSecond: getFinal(resolved, "ward_gained_per_second"),
    totalWardPerSecond: getFinal(resolved, "total_ward_per_second"),
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
