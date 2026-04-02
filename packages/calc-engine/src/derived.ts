import type { ResolvedStat } from "./resolve-stats.js";

export type DamageType = "fire" | "cold" | "lightning" | "physical" | "void" | "necrotic" | "poison";

export interface SimulationConfigLike {
  enemyLevel: number;
  enemyResistances?: Partial<Record<string, number>>;
}

export interface ActiveSkillDerivedBaseline {
  speedType: "attack" | "cast" | "auto";
  baseHitsPerSecond: number;
  baseDamage: number;
  addedDamageEffectiveness: number;
}

export interface DerivedComputationContext {
  activeSkillId?: string;
  activeSkillBaseline?: ActiveSkillDerivedBaseline;
  simulationConfig?: SimulationConfigLike;
}

/**
 * Derived stat definitions.
 * Each entry maps a derived stat to a function that computes it
 * from the resolved stats map.
 */
type DerivedStatFn = (stats: Map<string, ResolvedStat>) => number;

function getStat(stats: Map<string, ResolvedStat>, id: string): number {
  return stats.get(id)?.final ?? 0;
}

function sumStatsByPredicate(
  stats: Map<string, ResolvedStat>,
  predicate: (statId: string) => boolean,
): number {
  let total = 0;
  for (const [statId, resolved] of stats.entries()) {
    if (predicate(statId)) total += resolved.final;
  }
  return total;
}

function isGlobalFallbackStat(statId: string): boolean {
  return statId.startsWith("global_");
}

function getGenericCastSpeedBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id)
      &&
      id.includes("cast_speed")
      && id !== "cast_speed"
      && id !== "cast_speed_per_2_intelligence"
      && !id.includes("minion"),
  );
}

function getGenericCritChanceBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) => {
      const hasCrit = id.includes("crit") || id.includes("critical");
      const hasChance = id.includes("chance");
      return isGlobalFallbackStat(id)
        && hasCrit
        && hasChance
        && id !== "crit_chance"
        && id !== "base_crit_chance"
        && !id.includes("be_crit")
        && !id.includes("to_be_crit")
        && !id.includes("minion");
    },
  );
}

function getGenericCritMultiplierBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id)
      && (id.includes("crit_multiplier") || id.includes("critical_multiplier"))
      && id !== "crit_multiplier"
      && !id.includes("minion"),
  );
}

function getGenericIncreasedDamageBonus(stats: Map<string, ResolvedStat>): number {
  const known = new Set([
    "increased_damage",
    "increased_spell_damage",
    "increased_elemental_damage",
    "increased_fire_damage",
    "increased_cold_damage",
    "increased_lightning_damage",
    "increased_physical_damage",
    "increased_melee_damage",
  ]);

  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id)
      &&
      id.includes("increased")
      && id.includes("damage")
      && !known.has(id)
      && !id.includes("taken")
      && !id.includes("minion"),
  );
}

function getGenericMoreDamageBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id)
      &&
      id.includes("more")
      && id.includes("damage")
      && id !== "more_damage"
      && !id.includes("taken")
      && !id.includes("minion"),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function getEnemyLevelDamageReduction(level: number): number {
  // Maxroll model: universal enemy DR scales up to 87% at level 100.
  const clampedLevel = clamp(level, 0, 100);
  return 87 * (clampedLevel / 100);
}

function getDominantDamageType(stats: Map<string, ResolvedStat>): DamageType {
  const scores: Record<DamageType, number> = {
    fire: 0,
    cold: 0,
    lightning: 0,
    physical: 0,
    void: 0,
    necrotic: 0,
    poison: 0,
  };

  scores.fire += getStat(stats, "added_spell_fire_damage") + getStat(stats, "increased_fire_damage") + getStat(stats, "penetration_fire");
  scores.cold += getStat(stats, "added_spell_cold_damage") + getStat(stats, "increased_cold_damage") + getStat(stats, "penetration_cold");
  scores.lightning += getStat(stats, "added_spell_lightning_damage") + getStat(stats, "increased_lightning_damage") + getStat(stats, "penetration_lightning");
  scores.physical += getStat(stats, "added_melee_physical_damage") + getStat(stats, "increased_physical_damage") + getStat(stats, "penetration_physical");
  scores.void += getStat(stats, "increased_void_damage") + getStat(stats, "penetration_void");
  scores.necrotic += getStat(stats, "increased_necrotic_damage") + getStat(stats, "penetration_necrotic");
  scores.poison += getStat(stats, "increased_poison_damage");

  let best: DamageType = "lightning";
  for (const [type, score] of Object.entries(scores) as Array<[DamageType, number]>) {
    if (score > scores[best]) best = type;
  }
  return best;
}

function getTypeSpecificPenetration(stats: Map<string, ResolvedStat>, damageType: DamageType): number {
  const byType: Record<DamageType, number> = {
    fire: getStat(stats, "penetration_fire"),
    cold: getStat(stats, "penetration_cold"),
    lightning: getStat(stats, "penetration_lightning") + getStat(stats, "lightning_res_penetration"),
    physical: getStat(stats, "penetration_physical"),
    void: getStat(stats, "penetration_void"),
    necrotic: getStat(stats, "penetration_necrotic"),
    poison: 0,
  };
  return byType[damageType] ?? 0;
}

function getTypeSpecificShred(stats: Map<string, ResolvedStat>, damageType: DamageType): number {
  const byType: Record<DamageType, number> = {
    fire: getStat(stats, "fire_resistance_shred"),
    cold: getStat(stats, "cold_resistance_shred"),
    lightning: getStat(stats, "lightning_resistance_shred"),
    physical: getStat(stats, "physical_resistance_shred"),
    void: getStat(stats, "void_resistance_shred"),
    necrotic: getStat(stats, "necrotic_resistance_shred"),
    poison: getStat(stats, "poison_resistance_shred"),
  };
  return byType[damageType] ?? 0;
}

function getResistanceMultiplier(
  stats: Map<string, ResolvedStat>,
  context?: DerivedComputationContext,
): number {
  const damageType = getDominantDamageType(stats);
  const configRes = context?.simulationConfig?.enemyResistances?.[damageType] ?? 0;

  const penetration = Math.max(0,
    getStat(stats, "penetration") +
    getStat(stats, "penetration_elemental") +
    getTypeSpecificPenetration(stats, damageType),
  );
  const shred = Math.max(0, getTypeSpecificShred(stats, damageType));

  const finalResistance = configRes - penetration - shred;
  return Math.max(0.1, 1 - finalResistance / 100);
}

function getIncreasedDamageTakenMultiplier(stats: Map<string, ResolvedStat>, damageType: DamageType): number {
  const byType: Record<DamageType, number> = {
    fire: getStat(stats, "fire_damage_taken") + getStat(stats, "increased_fire_damage_taken"),
    cold: getStat(stats, "cold_damage_taken") + getStat(stats, "increased_cold_damage_taken"),
    lightning: getStat(stats, "lightning_damage_taken") + getStat(stats, "increased_lightning_damage_taken"),
    physical: getStat(stats, "physical_damage_taken") + getStat(stats, "increased_physical_damage_taken"),
    void: getStat(stats, "void_damage_taken") + getStat(stats, "increased_void_damage_taken"),
    necrotic: getStat(stats, "necrotic_damage_taken") + getStat(stats, "increased_necrotic_damage_taken"),
    poison: getStat(stats, "poison_damage_taken") + getStat(stats, "increased_poison_damage_taken"),
  };

  const generic = getStat(stats, "increased_damage_taken") + getStat(stats, "enemy_damage_taken");
  const total = Math.max(0, generic + (byType[damageType] ?? 0));
  return 1 + total / 100;
}

function getEnemyMitigationMultiplier(context?: DerivedComputationContext): number {
  const enemyLevel = context?.simulationConfig?.enemyLevel ?? 100;
  const dr = clamp(getEnemyLevelDamageReduction(enemyLevel), 0, 95);
  return 1 - dr / 100;
}

interface ExpectedDpsModel {
  speedFactor: number;
  castFactor: number;
  hitCountFactor: number;
  penetrationFactor: number;
  targetTakenFactor: number;
  resistanceFactor: number;
  increasedDamageTakenFactor: number;
  enemyMitigationFactor: number;
  dps: number;
}

function getExpectedDpsModel(
  stats: Map<string, ResolvedStat>,
  avgHit: number,
  baseline: ActiveSkillDerivedBaseline | undefined,
  activeSkillId: string | undefined,
  context: DerivedComputationContext | undefined,
): ExpectedDpsModel {
  const baseHitsPerSecond = getSkillBaseHitsPerSecond(stats, baseline?.baseHitsPerSecond ?? 1);
  const speedType = baseline?.speedType ?? "auto";
  const speed = getSpeedBonus(stats, speedType);
  const speedFactor = baseHitsPerSecond * (1 + speed / 100);

  const castFactor = activeSkillId ? getSkillCastMultiplier(stats) : 1;
  const hitCountFactor = activeSkillId ? getSkillHitCountMultiplier(stats) : 1;
  const penetrationFactor = activeSkillId ? getSkillPenetrationMultiplier(stats) : 1;
  const targetTakenFactor = activeSkillId ? getSkillTargetTakenMultiplier(stats) : 1;
  const dominantType = getDominantDamageType(stats);
  const resistanceFactor = getResistanceMultiplier(stats, context);
  const increasedDamageTakenFactor = getIncreasedDamageTakenMultiplier(stats, dominantType);
  const enemyMitigationFactor = getEnemyMitigationMultiplier(context);

  const dps = avgHit
    * speedFactor
    * castFactor
    * hitCountFactor
    * penetrationFactor
    * targetTakenFactor
    * resistanceFactor
    * increasedDamageTakenFactor
    * enemyMitigationFactor;

  return {
    speedFactor,
    castFactor,
    hitCountFactor,
    penetrationFactor,
    targetTakenFactor,
    resistanceFactor,
    increasedDamageTakenFactor,
    enemyMitigationFactor,
    dps,
  };
}

function getSpeedBonus(stats: Map<string, ResolvedStat>, speedType: "attack" | "cast" | "auto"): number {
  const intelligence = getStat(stats, "intelligence");
  const castFromInt = (intelligence / 2) * getStat(stats, "cast_speed_per_2_intelligence");
  const effectiveCastSpeed = getStat(stats, "cast_speed") + castFromInt + getGenericCastSpeedBonus(stats);

  if (speedType === "attack") return getStat(stats, "attack_speed");
  if (speedType === "cast") return effectiveCastSpeed;
  return Math.max(effectiveCastSpeed, getStat(stats, "attack_speed"));
}

interface SkillChainData {
  totalAdditionalChains: number;
  cannotChain: boolean;
}

function getSkillChainData(stats: Map<string, ResolvedStat>): SkillChainData {
  const cannotChain = getStat(stats, "cannot_chain") > 0;
  const baseAdditionalChains = cannotChain ? 0 : 2;
  const maxAdditionalChains = Math.max(0, getStat(stats, "maximum_additional_chains"));
  const extraPerRecentCast = Math.max(0, getStat(stats, "additional_chains_per_recent_direct_cast"));
  const halfMaxChains = getStat(stats, "half_maximum_chains") > 0;

  let totalAdditionalChains = baseAdditionalChains + maxAdditionalChains + extraPerRecentCast * 2;
  if (halfMaxChains) totalAdditionalChains *= 0.5;

  return { totalAdditionalChains: Math.max(0, totalAdditionalChains), cannotChain };
}

function getSkillHitMultiplier(stats: Map<string, ResolvedStat>): number {
  const { totalAdditionalChains } = getSkillChainData(stats);

  const perChainBonus = Math.max(0, getStat(stats, "damage_per_maximum_additional_chains"));
  const lessPerChainBonus = Math.max(0, getStat(stats, "less_bonus_damage_per_chain"));
  const chainBonusFactor = totalAdditionalChains * (perChainBonus / 100) * Math.max(0, 1 - lessPerChainBonus / 100);

  const vsShocked = Math.max(0, getStat(stats, "hit_damage_against_shocked_enemies")) / 100;
  const vsChilled = Math.max(0, getStat(stats, "hit_damage_against_chilled_enemies")) / 100;

  return (1 + chainBonusFactor) * (1 + vsShocked) * (1 + vsChilled);
}

function getSkillCastMultiplier(stats: Map<string, ResolvedStat>): number {
  const doublecastChance = Math.min(Math.max(0, getStat(stats, "doublecast_chance")), 100) / 100;
  const tripleCastChance = Math.min(Math.max(0, getStat(stats, "triple_cast_chance")), 100) / 100;
  const quadrupleCastChance = Math.min(Math.max(0, getStat(stats, "quadruple_cast_chance")), 100) / 100;
  const baseMultiplier = 1 + doublecastChance + tripleCastChance * 2 + quadrupleCastChance * 3;
  return Math.max(1, baseMultiplier);
}

function getSkillPenetrationMultiplier(stats: Map<string, ResolvedStat>): number {
  const penetration =
    Math.max(0, getStat(stats, "penetration_lightning")) +
    Math.max(0, getStat(stats, "penetration_elemental")) +
    Math.max(0, getStat(stats, "penetration")) +
    Math.max(0, getStat(stats, "lightning_res_penetration"));

  const maxPen = getStat(stats, "maximum_lightning_penetration");
  const appliedPen = maxPen > 0 ? Math.min(penetration, maxPen) : penetration;

  // For planner expected DPS we treat penetration as effective damage gain.
  return Math.max(0.1, 1 + appliedPen / 100);
}

function getSkillTargetTakenMultiplier(stats: Map<string, ResolvedStat>): number {
  const increasedVsShocked =
    Math.max(0, getStat(stats, "damage_to_shocked")) +
    Math.max(0, getStat(stats, "lightning_damage_to_shocked_enemies")) +
    Math.max(0, getStat(stats, "spell_damage_to_shocked_enemies"));

  const moreVsShocked = Math.max(0, getStat(stats, "more_damage_against_shocked"));

  return (1 + increasedVsShocked / 100) * (1 + moreVsShocked / 100);
}

function getSkillHitCountMultiplier(stats: Map<string, ResolvedStat>): number {
  const { totalAdditionalChains, cannotChain } = getSkillChainData(stats);
  if (cannotChain) return 1;

  let hitsPerCast = 1 + totalAdditionalChains;

  // Some skills can fork as an alternative path, increasing expected hit count.
  if (getStat(stats, "lightning_blast_can_fork_or_chain") > 0) {
    hitsPerCast *= 1.5;
  }

  // Channelled variants can reduce chaining frequency via "casts between chaining".
  const castsBetweenChaining = Math.max(1, getStat(stats, "casts_between_chaining"));
  if (getStat(stats, "lightning_blast_is_channelled") > 0 && totalAdditionalChains > 0) {
    const chainedPart = totalAdditionalChains / castsBetweenChaining;
    hitsPerCast = 1 + chainedPart;
  }

  return Math.max(1, hitsPerCast);
}

function getSkillBaseHitsPerSecond(
  stats: Map<string, ResolvedStat>,
  baselineHitsPerSecond: number,
): number {
  // Lightning Blast channel node transforms cast cadence to rapid ticks.
  if (getStat(stats, "lightning_blast_is_channelled") > 0) {
    return 1 / 0.13;
  }
  return baselineHitsPerSecond;
}

function buildDerivedStats(context?: DerivedComputationContext): [string, DerivedStatFn][] {
  const activeSkillId = context?.activeSkillId;
  const baseline = context?.activeSkillBaseline;

  return [
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

  // Average hit: base damage * (1 + Σincreased/100) * more multiplier * crit factor
  // Base damage = flat from weapons/implicits + added elemental/physical damage
  // Increased = sum of all increased damage types that apply globally
  // More = generic "more damage" multiplier applied post-increased
  [
    "average_hit",
    (stats) => {
      // Flat base damage from weapons/implicits
      const damage = getStat(stats, "damage");
      const spellDmg = getStat(stats, "spell_damage");
      const meleeDmg = getStat(stats, "melee_damage");

      // Added flat damage from nodes/affixes
      const addedDmg =
        getStat(stats, "added_spell_fire_damage") +
        getStat(stats, "added_spell_cold_damage") +
        getStat(stats, "added_spell_lightning_damage") +
        getStat(stats, "added_melee_physical_damage") +
        getStat(stats, "added_spell_damage");

      // For active skills, use skill baseline damage + effectiveness-scaled added damage.
      const baseDmg = baseline
        ? baseline.baseDamage + (damage + spellDmg + meleeDmg + addedDmg) * baseline.addedDamageEffectiveness
        : (() => {
            const rawBase = damage + spellDmg + meleeDmg + addedDmg;
            return rawBase > 0 ? rawBase : 100;
          })();

      // Sum all "increased" damage modifiers (these stack additively)
      const totalIncreased =
        getStat(stats, "increased_damage") +
        getStat(stats, "increased_spell_damage") +
        getStat(stats, "increased_elemental_damage") +
        getStat(stats, "increased_fire_damage") +
        getStat(stats, "increased_cold_damage") +
        getStat(stats, "increased_lightning_damage") +
        getStat(stats, "increased_physical_damage") +
        getStat(stats, "increased_melee_damage") +
        getGenericIncreasedDamageBonus(stats);

      // Last Epoch baseline: intelligence grants 4% increased damage with spells.
      const intelligenceSpellIncreased = baseline?.speedType === "cast"
        ? getStat(stats, "intelligence") * 4
        : 0;

      const afterInc = baseDmg * (1 + (totalIncreased + intelligenceSpellIncreased) / 100);

      // Generic "more damage" multiplier (additive accumulation, applied multiplicatively)
      const moreDamage = getStat(stats, "more_damage") + getGenericMoreDamageBonus(stats);
      const afterMore = afterInc * (1 + moreDamage / 100);

      // Crit: base_crit_chance is additive with crit_chance
      const totalCrit =
        getStat(stats, "crit_chance") +
        getStat(stats, "base_crit_chance") +
        getGenericCritChanceBonus(stats);
      const critChance = Math.min(totalCrit, 100) / 100;
      const critMulti = (getStat(stats, "crit_multiplier") + getGenericCritMultiplierBonus(stats)) / 100;

      const critAdjusted = afterMore * (1 + critChance * (critMulti - 1));

      // Apply additional skill-specific hit multipliers only in active-skill mode.
      return activeSkillId
        ? critAdjusted * getSkillHitMultiplier(stats)
        : critAdjusted;
    },
  ],

  // Expected DPS: average_hit * attacks_per_second
  [
    "expected_dps",
    (stats) => {
      const avgHit = getStat(stats, "average_hit");
      return getExpectedDpsModel(stats, avgHit, baseline, activeSkillId, context).dps;
    },
  ],

  ["dps_factor_speed", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).speedFactor],
  ["dps_factor_cast", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).castFactor],
  ["dps_factor_hit_count", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).hitCountFactor],
  ["dps_factor_penetration", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).penetrationFactor],
  ["dps_factor_target_taken", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).targetTakenFactor],
  ["dps_factor_resistance", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).resistanceFactor],
  ["dps_factor_increased_taken", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).increasedDamageTakenFactor],
  ["dps_factor_enemy_mitigation", (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).enemyMitigationFactor],
  ["enemy_level_dr", () => getEnemyLevelDamageReduction(context?.simulationConfig?.enemyLevel ?? 100)],
  ];
}

/**
 * Compute derived stats and merge them back into the stats map.
 * Runs in dependency order (health before effective_health, etc.).
 */
export function computeDerivedStats(
  stats: Map<string, ResolvedStat>,
  context?: DerivedComputationContext,
): void {
  for (const [statId, fn] of buildDerivedStats(context)) {
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
