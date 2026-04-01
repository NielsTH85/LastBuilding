/**
 * Canonical stat ID registry.
 * Every stat in the engine is identified by one of these string literals.
 */
export const STAT_IDS = [
  // Primary attributes
  "strength",
  "dexterity",
  "intelligence",
  "vitality",
  "attunement",

  // Core offense
  "melee_damage",
  "spell_damage",
  "minion_damage",
  "attack_speed",
  "cast_speed",
  "crit_chance",
  "crit_multiplier",
  "added_melee_physical_damage",
  "added_spell_fire_damage",
  "added_spell_cold_damage",
  "added_spell_lightning_damage",
  "added_spell_damage",
  "increased_elemental_damage",
  "increased_fire_damage",
  "increased_cold_damage",
  "increased_lightning_damage",
  "increased_spell_damage",
  "penetration_fire",
  "penetration_cold",
  "penetration_lightning",
  "penetration_elemental",
  "ailment_chance",
  "ignite_chance",
  "shock_chance",
  "freeze_rate_multiplier",

  // Core defense
  "health",
  "ward",
  "armor",
  "dodge_rating",
  "block_chance",
  "block_effectiveness",
  "endurance",
  "endurance_threshold",
  "fire_resistance",
  "cold_resistance",
  "lightning_resistance",
  "necrotic_resistance",
  "void_resistance",
  "poison_resistance",
  "less_damage_taken",
  "glancing_blow_chance",

  // Sustain & utility
  "mana",
  "mana_regen",
  "health_regen",
  "health_leech",
  "ward_generation",
  "ward_retention",
  "cooldown_recovery_speed",
  "movement_speed",

  // Derived / composite (computed by calc engine)
  "effective_health",
  "average_hit",
  "expected_dps",
] as const;

export type StatId = (typeof STAT_IDS)[number];

/** Set for fast lookup */
export const STAT_ID_SET: ReadonlySet<string> = new Set(STAT_IDS);
