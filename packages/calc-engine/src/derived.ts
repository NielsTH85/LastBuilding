import type { ResolvedStat } from "./resolve-stats.js";

export type DamageType =
  | "fire"
  | "cold"
  | "lightning"
  | "physical"
  | "void"
  | "necrotic"
  | "poison";

export interface SimulationConfigLike {
  enemyLevel: number;
  enemyResistances?: Partial<Record<string, number>>;
  enemyNearbyCount?: number;
  // Enemy ailment conditions
  enemyIsBoss?: boolean;
  enemyIsShocked?: boolean;
  enemyIsChilled?: boolean;
  enemyIsIgnited?: boolean;
  enemyIsPoisoned?: boolean;
  enemyIsBleeding?: boolean;
  enemyIsSlowed?: boolean;
  enemyIsStunned?: boolean;
  enemyArmorShredStacks?: number;
  // Player combat state
  playerAtFullHealth?: boolean;
  playerHasWard?: boolean;
  playerRecentlyUsedPotion?: boolean;
  playerRecentlyKilled?: boolean;
  playerRecentlyBeenHit?: boolean;
  playerMinionCount?: number;
}

export interface ActiveSkillDerivedBaseline {
  speedType: "attack" | "cast" | "auto";
  baseHitsPerSecond: number;
  baseDamage: number;
  addedDamageEffectiveness: number;
  baseCooldown?: number;
  baseManaCost?: number;
}

export interface DerivedComputationContext {
  playerLevel?: number;
  activeSkillId?: string;
  activeSkillBaseline?: ActiveSkillDerivedBaseline;
  activeSkillTags?: string[];
  simulationConfig?: SimulationConfigLike;
}

const HEALTH_PER_LEVEL = 12;

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
      isGlobalFallbackStat(id) &&
      id.includes("cast_speed") &&
      id !== "cast_speed" &&
      id !== "cast_speed_per_2_intelligence" &&
      !id.includes("minion"),
  );
}

function getGenericCritChanceBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(stats, (id) => {
    const hasCrit = id.includes("crit") || id.includes("critical");
    const hasChance = id.includes("chance");
    return (
      isGlobalFallbackStat(id) &&
      hasCrit &&
      hasChance &&
      id !== "crit_chance" &&
      id !== "base_crit_chance" &&
      !id.includes("be_crit") &&
      !id.includes("to_be_crit") &&
      !id.includes("minion")
    );
  });
}

function getGenericCritMultiplierBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id) &&
      (id.includes("crit_multiplier") || id.includes("critical_multiplier")) &&
      id !== "crit_multiplier" &&
      !id.includes("minion"),
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
      isGlobalFallbackStat(id) &&
      id.includes("increased") &&
      id.includes("damage") &&
      !known.has(id) &&
      !id.includes("taken") &&
      !id.includes("minion"),
  );
}

function getGenericMoreDamageBonus(stats: Map<string, ResolvedStat>): number {
  return sumStatsByPredicate(
    stats,
    (id) =>
      isGlobalFallbackStat(id) &&
      id.includes("more") &&
      id.includes("damage") &&
      id !== "more_damage" &&
      !id.includes("taken") &&
      !id.includes("minion"),
  );
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function hasActiveSkillTag(context: DerivedComputationContext | undefined, tag: string): boolean {
  return context?.activeSkillTags?.includes(tag) ?? false;
}

function getAreaCoverageFactor(
  stats: Map<string, ResolvedStat>,
  activeSkillId: string | undefined,
  context: DerivedComputationContext | undefined,
): number {
  if (!activeSkillId) return 1;
  if (!hasActiveSkillTag(context, "area")) return 1;

  const areaPercent = getStat(stats, "area") + getStat(stats, "increased_area");
  const areaMultiplier = Math.max(0.1, 1 + areaPercent / 100);
  const nearbyTargets = Math.max(1, context?.simulationConfig?.enemyNearbyCount ?? 1);
  return clamp(areaMultiplier, 1, nearbyTargets);
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

  scores.fire +=
    getStat(stats, "added_spell_fire_damage") +
    getStat(stats, "increased_fire_damage") +
    getStat(stats, "penetration_fire");
  scores.cold +=
    getStat(stats, "added_spell_cold_damage") +
    getStat(stats, "increased_cold_damage") +
    getStat(stats, "penetration_cold");
  scores.lightning +=
    getStat(stats, "added_spell_lightning_damage") +
    getStat(stats, "increased_lightning_damage") +
    getStat(stats, "penetration_lightning");
  scores.physical +=
    getStat(stats, "added_melee_physical_damage") +
    getStat(stats, "increased_physical_damage") +
    getStat(stats, "penetration_physical") +
    getStat(stats, "throwing_damage") +
    getStat(stats, "increased_throwing_damage");
  scores.void += getStat(stats, "increased_void_damage") + getStat(stats, "penetration_void");
  scores.necrotic +=
    getStat(stats, "increased_necrotic_damage") + getStat(stats, "penetration_necrotic");
  scores.poison += getStat(stats, "increased_poison_damage");

  let best: DamageType = "lightning";
  for (const [type, score] of Object.entries(scores) as Array<[DamageType, number]>) {
    if (score > scores[best]) best = type;
  }
  return best;
}

function getTypeSpecificPenetration(
  stats: Map<string, ResolvedStat>,
  damageType: DamageType,
): number {
  const byType: Record<DamageType, number> = {
    fire: getStat(stats, "penetration_fire"),
    cold: getStat(stats, "penetration_cold"),
    lightning:
      getStat(stats, "penetration_lightning") + getStat(stats, "lightning_res_penetration"),
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

  const penetration = Math.max(
    0,
    getStat(stats, "penetration") +
      getStat(stats, "penetration_elemental") +
      getTypeSpecificPenetration(stats, damageType),
  );
  const shred = Math.max(0, getTypeSpecificShred(stats, damageType));

  const finalResistance = configRes - penetration - shred;
  return Math.max(0.1, 1 - finalResistance / 100);
}

function getIncreasedDamageTakenMultiplier(
  stats: Map<string, ResolvedStat>,
  damageType: DamageType,
): number {
  const byType: Record<DamageType, number> = {
    fire: getStat(stats, "fire_damage_taken") + getStat(stats, "increased_fire_damage_taken"),
    cold: getStat(stats, "cold_damage_taken") + getStat(stats, "increased_cold_damage_taken"),
    lightning:
      getStat(stats, "lightning_damage_taken") + getStat(stats, "increased_lightning_damage_taken"),
    physical:
      getStat(stats, "physical_damage_taken") + getStat(stats, "increased_physical_damage_taken"),
    void: getStat(stats, "void_damage_taken") + getStat(stats, "increased_void_damage_taken"),
    necrotic:
      getStat(stats, "necrotic_damage_taken") + getStat(stats, "increased_necrotic_damage_taken"),
    poison: getStat(stats, "poison_damage_taken") + getStat(stats, "increased_poison_damage_taken"),
  };

  const generic = getStat(stats, "increased_damage_taken") + getStat(stats, "enemy_damage_taken");
  const total = Math.max(0, generic + (byType[damageType] ?? 0));
  return 1 + total / 100;
}

function getEnemyMitigationMultiplier(context?: DerivedComputationContext): number {
  const enemyLevel = context?.simulationConfig?.enemyLevel ?? 100;
  const armorShredStacks = context?.simulationConfig?.enemyArmorShredStacks ?? 0;
  // Each armor shred stack reduces enemy DR by ~1%
  const baseDr = getEnemyLevelDamageReduction(enemyLevel);
  const dr = clamp(baseDr - armorShredStacks, 0, 95);
  return 1 - dr / 100;
}

interface ExpectedDpsModel {
  speedFactor: number;
  castFactor: number;
  hitCountFactor: number;
  areaFactor: number;
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
  const areaFactor = getAreaCoverageFactor(stats, activeSkillId, context);
  const penetrationFactor = activeSkillId ? getSkillPenetrationMultiplier(stats) : 1;
  const targetTakenFactor = activeSkillId ? getSkillTargetTakenMultiplier(stats, context) : 1;
  const dominantType = getDominantDamageType(stats);
  const resistanceFactor = getResistanceMultiplier(stats, context);
  const increasedDamageTakenFactor = getIncreasedDamageTakenMultiplier(stats, dominantType);
  const enemyMitigationFactor = getEnemyMitigationMultiplier(context);

  const dps =
    avgHit *
    speedFactor *
    castFactor *
    hitCountFactor *
    areaFactor *
    penetrationFactor *
    targetTakenFactor *
    resistanceFactor *
    increasedDamageTakenFactor *
    enemyMitigationFactor;

  return {
    speedFactor,
    castFactor,
    hitCountFactor,
    areaFactor,
    penetrationFactor,
    targetTakenFactor,
    resistanceFactor,
    increasedDamageTakenFactor,
    enemyMitigationFactor,
    dps,
  };
}

type DotAilment = "ignite" | "bleed" | "poison";

interface DotAilmentModel {
  baseStackDps: number;
  baseDurationSeconds: number;
  specificChanceStat: string;
  specificIncreasedDamageStat: string;
  specificDurationStat: string;
}

const DOT_AILMENT_MODELS: Record<DotAilment, DotAilmentModel> = {
  ignite: {
    baseStackDps: 20,
    baseDurationSeconds: 3,
    specificChanceStat: "ignite_chance",
    specificIncreasedDamageStat: "increased_fire_damage",
    specificDurationStat: "ignite_duration",
  },
  bleed: {
    baseStackDps: 53,
    baseDurationSeconds: 4,
    specificChanceStat: "bleed_chance",
    specificIncreasedDamageStat: "increased_physical_damage",
    specificDurationStat: "bleed_duration",
  },
  poison: {
    baseStackDps: 20,
    baseDurationSeconds: 3,
    specificChanceStat: "poison_chance",
    specificIncreasedDamageStat: "increased_poison_damage",
    specificDurationStat: "poison_duration",
  },
};

function getAilmentDotDps(
  stats: Map<string, ResolvedStat>,
  activeSkillId: string | undefined,
  baseline: ActiveSkillDerivedBaseline | undefined,
  ailment: DotAilment,
): number {
  if (!activeSkillId) return 0;
  const model = DOT_AILMENT_MODELS[ailment];

  const usesPerSecond = getSkillUseRate(stats, baseline, activeSkillId);
  if (usesPerSecond <= 0) return 0;

  const hitsPerUse = getSkillHitCountMultiplier(stats);
  const chancePercent = Math.max(
    0,
    getStat(stats, "ailment_chance") + getStat(stats, model.specificChanceStat),
  );
  // LE-style ailment chance can exceed 100%, applying multiple stacks per hit.
  const expectedStacksPerHit = chancePercent / 100;
  const stacksAppliedPerSecond = usesPerSecond * hitsPerUse * expectedStacksPerHit;

  const durationIncrease = Math.max(
    0,
    getStat(stats, "ailment_duration") + getStat(stats, model.specificDurationStat),
  );
  const stackDurationSeconds = model.baseDurationSeconds * (1 + durationIncrease / 100);
  const steadyStateStacks = stacksAppliedPerSecond * stackDurationSeconds;

  const increasedDotDamage = Math.max(
    0,
    getStat(stats, "damage_over_time") + getStat(stats, model.specificIncreasedDamageStat),
  );
  const perStackDps = model.baseStackDps * (1 + increasedDotDamage / 100);
  return steadyStateStacks * perStackDps;
}

function getMinionStatSum(
  stats: Map<string, ResolvedStat>,
  predicate: (statId: string) => boolean,
): number {
  return sumStatsByPredicate(
    stats,
    (id) => id.includes("minion") && !id.endsWith("_estimate") && predicate(id),
  );
}

function getMinionDominantDamageType(stats: Map<string, ResolvedStat>): DamageType {
  const scores: Record<DamageType, number> = {
    fire: 0,
    cold: 0,
    lightning: 0,
    physical: 0,
    void: 0,
    necrotic: 0,
    poison: 0,
  };

  for (const [statId, resolved] of stats.entries()) {
    if (!statId.includes("minion") || !statId.includes("damage")) continue;
    if (statId.includes("taken")) continue;
    if (statId.includes("dps")) continue;

    for (const type of Object.keys(scores) as DamageType[]) {
      if (statId.includes(type)) scores[type] += Math.max(0, resolved.final);
    }
  }

  let best: DamageType = "physical";
  for (const [type, score] of Object.entries(scores) as Array<[DamageType, number]>) {
    if (score > scores[best]) best = type;
  }

  if (scores[best] <= 0) return getDominantDamageType(stats);
  return best;
}

function getResistanceMultiplierForDamageType(
  stats: Map<string, ResolvedStat>,
  damageType: DamageType,
  context?: DerivedComputationContext,
): number {
  const configRes = context?.simulationConfig?.enemyResistances?.[damageType] ?? 0;

  const penetration = Math.max(
    0,
    getStat(stats, "penetration") +
      getStat(stats, "penetration_elemental") +
      getTypeSpecificPenetration(stats, damageType),
  );
  const shred = Math.max(0, getTypeSpecificShred(stats, damageType));

  const finalResistance = configRes - penetration - shred;
  return Math.max(0.1, 1 - finalResistance / 100);
}

function getMinionAverageHitEstimate(
  stats: Map<string, ResolvedStat>,
  context: DerivedComputationContext | undefined,
): number {
  const minionCount = Math.max(0, context?.simulationConfig?.playerMinionCount ?? 0);
  if (minionCount <= 0) return 0;

  const baseDamage = Math.max(0, getStat(stats, "minion_damage"));
  const addedMinionDamage = Math.max(
    0,
    getMinionStatSum(
      stats,
      (id) =>
        id !== "minion_damage" &&
        id.includes("damage") &&
        !id.includes("increased") &&
        !id.includes("more") &&
        !id.includes("chance") &&
        !id.includes("multiplier"),
    ),
  );

  const dominantType = getMinionDominantDamageType(stats);
  const typeIncreased = Math.max(0, getStat(stats, `increased_${dominantType}_damage`));
  const increased =
    Math.max(0, getStat(stats, "increased_minion_damage")) +
    Math.max(
      0,
      getMinionStatSum(
        stats,
        (id) =>
          id !== "increased_minion_damage" && id.includes("increased") && id.includes("damage"),
      ),
    ) +
    typeIncreased;

  const more = Math.max(
    0,
    getMinionStatSum(stats, (id) => id.includes("more") && id.includes("damage")),
  );

  const critChanceBonus = Math.max(
    0,
    getMinionStatSum(stats, (id) => {
      const hasCrit = id.includes("crit") || id.includes("critical");
      const hasChance = id.includes("chance");
      return hasCrit && hasChance && !id.includes("to_be_crit") && !id.includes("be_crit");
    }),
  );
  const critChance = Math.min(100, 5 + critChanceBonus) / 100;
  const critMultiplierBonus = Math.max(
    0,
    getMinionStatSum(
      stats,
      (id) => id.includes("crit_multiplier") || id.includes("critical_multiplier"),
    ),
  );
  const critMultiplier = (200 + critMultiplierBonus) / 100;

  const baseHit = Math.max(0, baseDamage + addedMinionDamage);
  const afterIncreased = baseHit * (1 + increased / 100);
  const afterMore = afterIncreased * (1 + more / 100);
  return afterMore * (1 + critChance * (critMultiplier - 1));
}

function getMinionDpsEstimate(
  stats: Map<string, ResolvedStat>,
  context: DerivedComputationContext | undefined,
): number {
  const minionCount = Math.max(0, context?.simulationConfig?.playerMinionCount ?? 0);
  if (minionCount <= 0) return 0;

  const perMinionHit = getMinionAverageHitEstimate(stats, context);
  const speedBonus = Math.max(
    0,
    getMinionStatSum(stats, (id) => {
      if (!id.includes("speed")) return false;
      if (id.includes("movement")) return false;
      if (id.includes("cooldown")) return false;
      return true;
    }),
  );
  const perMinionActionsPerSecond = 1 * (1 + speedBonus / 100);

  const minionDamageType = getMinionDominantDamageType(stats);
  const resistanceFactor = getResistanceMultiplierForDamageType(stats, minionDamageType, context);
  const increasedTakenFactor = getIncreasedDamageTakenMultiplier(stats, minionDamageType);
  const enemyMitigationFactor = getEnemyMitigationMultiplier(context);

  return (
    minionCount *
    perMinionHit *
    perMinionActionsPerSecond *
    resistanceFactor *
    increasedTakenFactor *
    enemyMitigationFactor
  );
}

function getSkillUseRate(
  stats: Map<string, ResolvedStat>,
  baseline: ActiveSkillDerivedBaseline | undefined,
  activeSkillId: string | undefined,
): number {
  if (!activeSkillId) return 0;
  const baseHitsPerSecond = getSkillBaseHitsPerSecond(stats, baseline?.baseHitsPerSecond ?? 1);
  const speedType = baseline?.speedType ?? "auto";
  const speed = getSpeedBonus(stats, speedType);
  const speedFactor = baseHitsPerSecond * (1 + speed / 100);
  const castFactor = getSkillCastMultiplier(stats);
  return Math.max(0, speedFactor * castFactor);
}

function getEffectiveCooldownSeconds(
  stats: Map<string, ResolvedStat>,
  baseline: ActiveSkillDerivedBaseline | undefined,
): number {
  const baseCooldown = baseline?.baseCooldown ?? 0;
  if (baseCooldown <= 0) return 0;
  const cdr = Math.max(0, getStat(stats, "cooldown_recovery_speed"));
  return baseCooldown / (1 + cdr / 100);
}

function getEffectiveManaCostPerUse(
  stats: Map<string, ResolvedStat>,
  baseline: ActiveSkillDerivedBaseline | undefined,
): number {
  const baseManaCost = baseline?.baseManaCost ?? 0;
  if (baseManaCost <= 0) return 0;

  const flatCostOffset = getStat(stats, "mana_cost");
  const manaEfficiency = Math.max(0, getStat(stats, "mana_efficiency"));
  const preEfficiencyCost = Math.max(0, baseManaCost + flatCostOffset);
  const multiplier = Math.max(0, 1 - manaEfficiency / 100);
  return preEfficiencyCost * multiplier;
}

function getSpeedBonus(
  stats: Map<string, ResolvedStat>,
  speedType: "attack" | "cast" | "auto",
): number {
  const intelligence = getStat(stats, "intelligence");
  const castFromInt = (intelligence / 2) * getStat(stats, "cast_speed_per_2_intelligence");
  const effectiveCastSpeed =
    getStat(stats, "cast_speed") + castFromInt + getGenericCastSpeedBonus(stats);

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
  const extraPerRecentCast = Math.max(
    0,
    getStat(stats, "additional_chains_per_recent_direct_cast"),
  );
  const halfMaxChains = getStat(stats, "half_maximum_chains") > 0;

  let totalAdditionalChains = baseAdditionalChains + maxAdditionalChains + extraPerRecentCast * 2;
  if (halfMaxChains) totalAdditionalChains *= 0.5;

  return { totalAdditionalChains: Math.max(0, totalAdditionalChains), cannotChain };
}

function getSkillHitMultiplier(
  stats: Map<string, ResolvedStat>,
  context?: DerivedComputationContext,
): number {
  const { totalAdditionalChains } = getSkillChainData(stats);

  const perChainBonus = Math.max(0, getStat(stats, "damage_per_maximum_additional_chains"));
  const lessPerChainBonus = Math.max(0, getStat(stats, "less_bonus_damage_per_chain"));
  const chainBonusFactor =
    totalAdditionalChains * (perChainBonus / 100) * Math.max(0, 1 - lessPerChainBonus / 100);

  const cfg = context?.simulationConfig;

  // Conditional vs-ailment hit bonuses (only active when the enemy condition is toggled on)
  const vsShocked = cfg?.enemyIsShocked
    ? Math.max(0, getStat(stats, "hit_damage_against_shocked_enemies")) / 100
    : 0;
  const vsChilled = cfg?.enemyIsChilled
    ? Math.max(0, getStat(stats, "hit_damage_against_chilled_enemies")) / 100
    : 0;
  const vsIgnited = cfg?.enemyIsIgnited
    ? Math.max(0, getStat(stats, "hit_damage_against_ignited_enemies")) / 100
    : 0;
  const vsPoisoned = cfg?.enemyIsPoisoned
    ? Math.max(0, getStat(stats, "hit_damage_against_poisoned_enemies")) / 100
    : 0;
  const vsBleeding = cfg?.enemyIsBleeding
    ? Math.max(0, getStat(stats, "hit_damage_against_bleeding_enemies")) / 100
    : 0;
  const vsSlowed = cfg?.enemyIsSlowed
    ? Math.max(0, getStat(stats, "hit_damage_against_slowed_enemies")) / 100
    : 0;
  const vsStunned = cfg?.enemyIsStunned
    ? Math.max(0, getStat(stats, "hit_damage_against_stunned_enemies")) / 100
    : 0;

  // Player state bonuses
  const atFullHealth = cfg?.playerAtFullHealth
    ? Math.max(0, getStat(stats, "hit_damage_at_full_health")) / 100
    : 0;
  const hasWard = cfg?.playerHasWard
    ? Math.max(0, getStat(stats, "hit_damage_with_ward")) / 100
    : 0;

  return (
    (1 + chainBonusFactor) *
    (1 + vsShocked) *
    (1 + vsChilled) *
    (1 + vsIgnited) *
    (1 + vsPoisoned) *
    (1 + vsBleeding) *
    (1 + vsSlowed) *
    (1 + vsStunned) *
    (1 + atFullHealth) *
    (1 + hasWard)
  );
}

function getSkillCastMultiplier(stats: Map<string, ResolvedStat>): number {
  const doublecastChance = Math.min(Math.max(0, getStat(stats, "doublecast_chance")), 100) / 100;
  const tripleCastChance = Math.min(Math.max(0, getStat(stats, "triple_cast_chance")), 100) / 100;
  const quadrupleCastChance =
    Math.min(Math.max(0, getStat(stats, "quadruple_cast_chance")), 100) / 100;
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

function getSkillTargetTakenMultiplier(
  stats: Map<string, ResolvedStat>,
  context?: DerivedComputationContext,
): number {
  const cfg = context?.simulationConfig;
  let factor = 1;

  // Shocked
  if (cfg?.enemyIsShocked) {
    const increased =
      Math.max(0, getStat(stats, "damage_to_shocked")) +
      Math.max(0, getStat(stats, "lightning_damage_to_shocked_enemies")) +
      Math.max(0, getStat(stats, "spell_damage_to_shocked_enemies"));
    const more = Math.max(0, getStat(stats, "more_damage_against_shocked"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Chilled
  if (cfg?.enemyIsChilled) {
    const increased = Math.max(0, getStat(stats, "damage_to_chilled"));
    const more = Math.max(0, getStat(stats, "more_damage_against_chilled"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Ignited
  if (cfg?.enemyIsIgnited) {
    const increased = Math.max(0, getStat(stats, "damage_to_ignited"));
    const more = Math.max(0, getStat(stats, "more_damage_against_ignited"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Poisoned
  if (cfg?.enemyIsPoisoned) {
    const increased = Math.max(0, getStat(stats, "damage_to_poisoned"));
    const more = Math.max(0, getStat(stats, "more_damage_against_poisoned"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Bleeding
  if (cfg?.enemyIsBleeding) {
    const increased = Math.max(0, getStat(stats, "damage_to_bleeding"));
    const more = Math.max(0, getStat(stats, "more_damage_against_bleeding"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Slowed
  if (cfg?.enemyIsSlowed) {
    const increased = Math.max(0, getStat(stats, "damage_to_slowed"));
    const more = Math.max(0, getStat(stats, "more_damage_against_slowed"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Stunned
  if (cfg?.enemyIsStunned) {
    const increased = Math.max(0, getStat(stats, "damage_to_stunned"));
    const more = Math.max(0, getStat(stats, "more_damage_against_stunned"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  // Boss-specific
  if (cfg?.enemyIsBoss) {
    const increased = Math.max(0, getStat(stats, "damage_to_bosses"));
    const more = Math.max(0, getStat(stats, "more_damage_against_bosses"));
    factor *= (1 + increased / 100) * (1 + more / 100);
  }

  return factor;
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

// ── Defensive formulas (Last Epoch 1.x) ────────────

/**
 * Armor → physical damage reduction.
 * Last Epoch formula: DR = armor / (armor + 1400)
 * Where 1400 is the level-100 divisor.
 */
function getArmorDamageReduction(armor: number): number {
  if (armor <= 0) return 0;
  return clamp((armor / (armor + 1400)) * 100, 0, 85);
}

/**
 * Dodge rating → dodge chance.
 * Last Epoch formula: dodge% = dodgeRating / (dodgeRating + 700)
 */
function getDodgeChance(dodgeRating: number): number {
  if (dodgeRating <= 0) return 0;
  return clamp((dodgeRating / (dodgeRating + 700)) * 100, 0, 85);
}

function buildDerivedStats(context?: DerivedComputationContext): [string, DerivedStatFn][] {
  const activeSkillId = context?.activeSkillId;
  const baseline = context?.activeSkillBaseline;

  return [
    // Health: (base + flat + vitality scaling + level scaling) then increased/more.
    [
      "health",
      (stats) => {
        const health = stats.get("health");
        const healthBase = health?.base ?? 0;
        const healthAdded = health?.added ?? 0;
        const healthIncreased = health?.increased ?? 0;
        const healthMore = health?.more ?? 0;
        const vitality = getStat(stats, "vitality");
        const level = Math.max(1, Math.floor(context?.playerLevel ?? 1));
        const levelHealth = (level - 1) * HEALTH_PER_LEVEL;
        const preScaling = healthBase + healthAdded + vitality * 10 + levelHealth;
        return preScaling * (1 + healthIncreased / 100) * (1 + healthMore / 100);
      },
    ],

    // ── Defensive derived stats ────────────────────────

    // Armor damage reduction (physical)
    [
      "armor_damage_reduction",
      (stats) => {
        const armor = getStat(stats, "armor");
        return getArmorDamageReduction(armor);
      },
    ],

    // Dodge chance
    [
      "dodge_chance",
      (stats) => {
        const dodgeRating = getStat(stats, "dodge_rating");
        return getDodgeChance(dodgeRating);
      },
    ],

    // Block damage reduction: when a hit is blocked, block_effectiveness% of it is prevented
    [
      "block_damage_reduction",
      (stats) => {
        const blockChance = clamp(getStat(stats, "block_chance"), 0, 100);
        const blockEffect = clamp(getStat(stats, "block_effectiveness"), 0, 100);
        // Average DR from blocking = chance × effectiveness
        return (blockChance / 100) * blockEffect;
      },
    ],

    // Glancing blow average DR: 35% damage reduction × glancing_blow_chance%
    [
      "glancing_blow_damage_reduction",
      (stats) => {
        const chance = clamp(getStat(stats, "glancing_blow_chance"), 0, 100);
        return (chance / 100) * 35; // 35% base reduction
      },
    ],

    // Less damage taken: direct multiplicative DR (e.g. from Sentinel/VK passives)
    [
      "total_less_damage_taken",
      (stats) => {
        return clamp(getStat(stats, "less_damage_taken"), 0, 100);
      },
    ],

    // Effective Health: accounts for armor, dodge, block, endurance, glancing blow, less damage taken
    [
      "effective_health",
      (stats) => {
        const health = getStat(stats, "health");
        const ward = getStat(stats, "ward");
        const rawPool = health + ward;

        // Physical DR from armor
        const armorDr = getArmorDamageReduction(getStat(stats, "armor")) / 100;

        // Dodge avoidance (effectively multiplies EHP)
        const dodgeChance = getDodgeChance(getStat(stats, "dodge_rating")) / 100;

        // Block: average damage prevented per hit
        const blockChance = clamp(getStat(stats, "block_chance"), 0, 100) / 100;
        const blockEffect = clamp(getStat(stats, "block_effectiveness"), 0, 100) / 100;
        const avgBlockDr = blockChance * blockEffect;

        // Glancing blow: 35% DR × chance
        const glancingChance = clamp(getStat(stats, "glancing_blow_chance"), 0, 100) / 100;
        const avgGlancingDr = glancingChance * 0.35;

        // Less damage taken (multiplicative)
        const lessDr = clamp(getStat(stats, "less_damage_taken"), 0, 100) / 100;

        // Endurance: provides flat 60% DR when below threshold
        const endurance = getStat(stats, "endurance");
        const enduranceThresholdPct = clamp(getStat(stats, "endurance_threshold"), 0, 100) / 100;
        // Approximate: fraction of health pool covered by endurance threshold × 60% DR
        const enduranceDr = endurance > 0 ? enduranceThresholdPct * 0.6 : 0;

        // Combine multiplicative layers: each layer multiplies effective pool
        // Dodge: expected hits to kill = pool / (1 - dodgeChance)
        // Armor: physical damage reduced
        // Block, glancing, less: averaged multiplicative reduction
        const survivalMultiplier =
          (1 / Math.max(0.01, 1 - dodgeChance)) *
          (1 / Math.max(0.01, 1 - armorDr * 0.5)) * // Weight armor at 50% (not all damage is physical)
          (1 / Math.max(0.01, 1 - avgBlockDr)) *
          (1 / Math.max(0.01, 1 - avgGlancingDr)) *
          (1 / Math.max(0.01, 1 - lessDr)) *
          (1 / Math.max(0.01, 1 - enduranceDr));

        return rawPool * survivalMultiplier;
      },
    ],

    // Average hit: base damage * (1 + Σincreased/100) * more multiplier * crit factor
    // Base damage = flat from weapons/implicits + added elemental/physical damage
    // Increased = sum of all increased damage types that apply globally
    // More = generic "more damage" multiplier applied post-increased
    [
      "average_hit",
      (stats) => {
        const activeSkillIsThrowing = hasActiveSkillTag(context, "throwing");
        const activeSkillIsCast =
          baseline?.speedType === "cast" || hasActiveSkillTag(context, "spell");
        const activeSkillIsAttack =
          baseline?.speedType === "attack" || hasActiveSkillTag(context, "attack");

        const includeSpellDamage = activeSkillId ? activeSkillIsCast : true;
        const includeThrowingDamage = activeSkillId ? activeSkillIsThrowing : true;
        const includeMeleeDamage = activeSkillId
          ? activeSkillIsAttack && !activeSkillIsThrowing && !activeSkillIsCast
          : true;

        // Flat base damage from weapons/implicits
        const damage = getStat(stats, "damage");
        const spellDmg = includeSpellDamage ? getStat(stats, "spell_damage") : 0;
        const meleeDmg = includeMeleeDamage ? getStat(stats, "melee_damage") : 0;
        const throwingDmg = includeThrowingDamage ? getStat(stats, "throwing_damage") : 0;

        // Added flat damage from nodes/affixes
        const addedDmg =
          getStat(stats, "added_spell_fire_damage") +
          getStat(stats, "added_spell_cold_damage") +
          getStat(stats, "added_spell_lightning_damage") +
          getStat(stats, "added_melee_physical_damage") +
          getStat(stats, "added_spell_damage");

        // For active skills, use skill baseline damage + effectiveness-scaled added damage.
        const baseDmg = baseline
          ? baseline.baseDamage +
            (damage + spellDmg + meleeDmg + throwingDmg + addedDmg) *
              baseline.addedDamageEffectiveness
          : (() => {
              const rawBase = damage + spellDmg + meleeDmg + throwingDmg + addedDmg;
              return rawBase > 0 ? rawBase : 100;
            })();

        // Sum all "increased" damage modifiers (these stack additively)
        const totalIncreased =
          getStat(stats, "increased_damage") +
          (includeSpellDamage
            ? getStat(stats, "increased_spell_damage") +
              getStat(stats, "increased_elemental_damage") +
              getStat(stats, "increased_fire_damage") +
              getStat(stats, "increased_cold_damage") +
              getStat(stats, "increased_lightning_damage")
            : 0) +
          (includeMeleeDamage
            ? getStat(stats, "increased_physical_damage") + getStat(stats, "increased_melee_damage")
            : 0) +
          (includeThrowingDamage
            ? getStat(stats, "increased_physical_damage") +
              getStat(stats, "increased_throwing_damage")
            : 0) +
          getGenericIncreasedDamageBonus(stats);

        // Last Epoch baseline: intelligence grants 4% increased damage with spells.
        const intelligenceSpellIncreased =
          baseline?.speedType === "cast" ? getStat(stats, "intelligence") * 4 : 0;

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
        const critMulti =
          (getStat(stats, "crit_multiplier") + getGenericCritMultiplierBonus(stats)) / 100;

        const critAdjusted = afterMore * (1 + critChance * (critMulti - 1));

        // Apply additional skill-specific hit multipliers only in active-skill mode.
        return activeSkillId ? critAdjusted * getSkillHitMultiplier(stats, context) : critAdjusted;
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

    ["minion_average_hit_estimate", (stats) => getMinionAverageHitEstimate(stats, context)],
    ["minion_dps_estimate", (stats) => getMinionDpsEstimate(stats, context)],

    [
      "dps_factor_speed",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).speedFactor,
    ],
    [
      "dps_factor_cast",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).castFactor,
    ],
    [
      "dps_factor_hit_count",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).hitCountFactor,
    ],
    [
      "dps_factor_area",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).areaFactor,
    ],
    [
      "dps_factor_penetration",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).penetrationFactor,
    ],
    [
      "dps_factor_target_taken",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).targetTakenFactor,
    ],
    [
      "dps_factor_resistance",
      (stats) => getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).resistanceFactor,
    ],
    [
      "dps_factor_increased_taken",
      (stats) =>
        getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).increasedDamageTakenFactor,
    ],
    [
      "dps_factor_enemy_mitigation",
      (stats) =>
        getExpectedDpsModel(stats, 1, baseline, activeSkillId, context).enemyMitigationFactor,
    ],
    [
      "enemy_level_dr",
      () => getEnemyLevelDamageReduction(context?.simulationConfig?.enemyLevel ?? 100),
    ],

    // Skill usage cadence and cooldown impact
    ["skill_uses_per_second", (stats) => getSkillUseRate(stats, baseline, activeSkillId)],
    ["effective_skill_cooldown", (stats) => getEffectiveCooldownSeconds(stats, baseline)],

    // Mana sustainability
    [
      "mana_cost_per_second",
      (stats) => {
        const costPerUse = getEffectiveManaCostPerUse(stats, baseline);
        const useRate = getSkillUseRate(stats, baseline, activeSkillId);
        return costPerUse * useRate;
      },
    ],
    [
      "mana_net_per_second",
      (stats) => {
        const regen = getStat(stats, "mana_regen");
        const spend = getStat(stats, "mana_cost_per_second");
        return regen - spend;
      },
    ],
    [
      "time_to_oom_seconds",
      (stats) => {
        const manaPool = getStat(stats, "mana");
        const net = getStat(stats, "mana_net_per_second");
        // Use a large finite sentinel for stable sustain to keep delta math finite.
        if (net >= 0) return 1_000_000_000;
        return manaPool / Math.max(0.0001, -net);
      },
    ],

    // Sustain metrics
    [
      "health_leech_per_second",
      (stats) => {
        const dps = getStat(stats, "expected_dps");
        const leechPct = Math.max(0, getStat(stats, "health_leech"));
        return dps * (leechPct / 100);
      },
    ],
    [
      "ward_per_second",
      (stats) => {
        const baseWardGain = Math.max(0, getStat(stats, "ward_generation"));
        const retention = Math.max(0, getStat(stats, "ward_retention"));
        return baseWardGain * (1 + retention / 100);
      },
    ],

    // Ailment DoT DPS (steady-state stack/tick simulation)
    ["ignite_dps_estimate", (stats) => getAilmentDotDps(stats, activeSkillId, baseline, "ignite")],
    ["bleed_dps_estimate", (stats) => getAilmentDotDps(stats, activeSkillId, baseline, "bleed")],
    ["poison_dps_estimate", (stats) => getAilmentDotDps(stats, activeSkillId, baseline, "poison")],
    [
      "ailment_dps_estimate",
      (stats) =>
        getStat(stats, "ignite_dps_estimate") +
        getStat(stats, "bleed_dps_estimate") +
        getStat(stats, "poison_dps_estimate"),
    ],
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
