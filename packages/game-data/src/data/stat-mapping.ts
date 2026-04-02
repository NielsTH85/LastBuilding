/**
 * Maps maxroll stat display names to our StatId + ModifierOperation.
 * Stats not in this map are stored as descriptive-only (shown in tooltips
 * but don't affect calculations).
 */

import type { StatId } from "../stats.js";
import type { ModifierOperation } from "../modifiers.js";

export interface StatMapping {
  targetStat: StatId;
  operation: ModifierOperation;
  /** Multiplier to apply to parsed value (default 1) */
  valueMul?: number;
}

/**
 * Mapping from lowercase maxroll statName → our stat system.
 * The value string from maxroll is like "+1", "+3%", "+10%", etc.
 * We parse the numeric part separately.
 */
const STAT_MAP: Record<string, StatMapping> = {
  // Attributes
  intelligence: { targetStat: "intelligence", operation: "add" },
  "intelligence with a catalyst": {
    targetStat: "intelligence",
    operation: "add",
  },
  strength: { targetStat: "strength", operation: "add" },
  dexterity: { targetStat: "dexterity", operation: "add" },
  vitality: { targetStat: "vitality", operation: "add" },
  attunement: { targetStat: "attunement", operation: "add" },

  // Health / mana
  health: { targetStat: "health", operation: "add" },
  mana: { targetStat: "mana", operation: "add" },
  "health regeneration": { targetStat: "health_regen", operation: "add" },
  "mana regeneration": { targetStat: "mana_regen", operation: "add" },
  "mana cost": { targetStat: "mana_cost", operation: "add" },
  "mana efficiency": { targetStat: "mana_efficiency", operation: "add" },
  "mana gain": { targetStat: "mana_gain", operation: "add" },
  "mana consumption": { targetStat: "mana_cost", operation: "add" },

  // Generic damage
  damage: { targetStat: "increased_damage", operation: "add" },
  "more damage": { targetStat: "more_damage", operation: "add" },
  "increased damage": { targetStat: "increased_damage", operation: "add" },
  "hit damage": { targetStat: "hit_damage", operation: "add" },
  "damage over time": { targetStat: "damage_over_time", operation: "add" },
  "melee damage": { targetStat: "melee_damage", operation: "add" },
  "physical damage": { targetStat: "physical_damage", operation: "add" },
  "throwing damage": { targetStat: "throwing_damage", operation: "add" },
  "minion damage": { targetStat: "minion_damage", operation: "add" },
  "added fire damage": { targetStat: "added_spell_fire_damage", operation: "add" },
  "added cold damage": { targetStat: "added_spell_cold_damage", operation: "add" },
  "added lightning damage": { targetStat: "added_spell_lightning_damage", operation: "add" },
  "added spell fire damage": { targetStat: "added_spell_fire_damage", operation: "add" },
  "added spell cold damage": { targetStat: "added_spell_cold_damage", operation: "add" },
  "added spell lightning damage": { targetStat: "added_spell_lightning_damage", operation: "add" },
  "melee physical damage": { targetStat: "added_melee_physical_damage", operation: "add" },
  "necrotic damage": { targetStat: "damage", operation: "add" },
  "void damage": { targetStat: "damage", operation: "add" },

  // Increased damage types
  "increased melee damage": {
    targetStat: "increased_melee_damage",
    operation: "add",
  },
  "increased physical damage": {
    targetStat: "increased_physical_damage",
    operation: "add",
  },
  "increased throwing damage": {
    targetStat: "increased_throwing_damage",
    operation: "add",
  },
  "increased necrotic damage": {
    targetStat: "increased_necrotic_damage",
    operation: "add",
  },
  "increased void damage": {
    targetStat: "increased_void_damage",
    operation: "add",
  },
  "increased poison damage": {
    targetStat: "increased_poison_damage",
    operation: "add",
  },
  "increased minion damage": {
    targetStat: "increased_minion_damage",
    operation: "add",
  },
  "more melee damage": {
    targetStat: "melee_damage",
    operation: "more",
  },

  // Spell damage
  "increased spell damage": {
    targetStat: "increased_spell_damage",
    operation: "add",
  },
  "more spell damage": { targetStat: "spell_damage", operation: "more" },
  "spell damage": { targetStat: "spell_damage", operation: "add" },
  "spell cold damage with runeword: avalanche": {
    targetStat: "added_spell_cold_damage",
    operation: "add",
  },
  "spell fire damage with runeword: inferno": {
    targetStat: "added_spell_fire_damage",
    operation: "add",
  },
  "spell lightning damage with runeword: hurricane": {
    targetStat: "added_spell_lightning_damage",
    operation: "add",
  },

  // Elemental damage
  "increased fire damage": {
    targetStat: "increased_fire_damage",
    operation: "add",
  },
  "increased cold damage": {
    targetStat: "increased_cold_damage",
    operation: "add",
  },
  "increased lightning damage": {
    targetStat: "increased_lightning_damage",
    operation: "add",
  },
  "increased elemental damage": {
    targetStat: "increased_elemental_damage",
    operation: "add",
  },
  "increased damage over time": {
    targetStat: "increased_elemental_damage",
    operation: "add",
  },

  // Crit
  "base crit chance": { targetStat: "base_crit_chance", operation: "add" },
  "base critical strike chance": {
    targetStat: "base_crit_chance",
    operation: "add",
  },
  "critical strike chance": { targetStat: "crit_chance", operation: "add" },
  "critical chance": { targetStat: "crit_chance", operation: "add" },
  "increased crit chance": { targetStat: "crit_chance", operation: "add" },
  "increased critical strike chance": {
    targetStat: "crit_chance",
    operation: "add",
  },
  "critical multiplier": { targetStat: "crit_multiplier", operation: "add" },
  "critical strike multiplier": {
    targetStat: "crit_multiplier",
    operation: "add",
  },
  "critical strike multiplier with a wand": {
    targetStat: "crit_multiplier",
    operation: "add",
  },

  // Speed
  "attack speed": { targetStat: "attack_speed", operation: "add" },
  "increased attack speed": {
    targetStat: "attack_speed",
    operation: "add",
  },
  "melee attack speed": { targetStat: "attack_speed", operation: "add" },
  "throwing attack speed": { targetStat: "attack_speed", operation: "add" },
  "cast speed": { targetStat: "cast_speed", operation: "add" },
  "increased cast speed": { targetStat: "cast_speed", operation: "add" },
  "cast speed with a staff": { targetStat: "cast_speed", operation: "add" },
  "attack and cast speed": { targetStat: "attack_speed", operation: "add" },

  // Defense
  armor: { targetStat: "armor", operation: "add" },
  "dodge rating": { targetStat: "dodge_rating", operation: "add" },
  "physical resistance": {
    targetStat: "physical_resistance",
    operation: "add",
  },
  "ward retention": { targetStat: "ward_retention", operation: "add" },
  "ward retention with a sceptre": {
    targetStat: "ward_retention",
    operation: "add",
  },
  "ward per second": { targetStat: "ward_generation", operation: "add" },
  "ward gained": { targetStat: "ward_gained", operation: "add" },
  "fire resistance": { targetStat: "fire_resistance", operation: "add" },
  "cold resistance": { targetStat: "cold_resistance", operation: "add" },
  "lightning resistance": {
    targetStat: "lightning_resistance",
    operation: "add",
  },
  "necrotic resistance": {
    targetStat: "necrotic_resistance",
    operation: "add",
  },
  "void resistance": { targetStat: "void_resistance", operation: "add" },
  "poison resistance": { targetStat: "poison_resistance", operation: "add" },
  endurance: { targetStat: "endurance", operation: "add" },
  "endurance threshold": {
    targetStat: "endurance_threshold",
    operation: "add",
  },
  "less damage taken from ignited shocked or chilled enemies": {
    targetStat: "less_damage_taken",
    operation: "add",
  },

  // Sustain & movement
  "increased health regen": {
    targetStat: "health_regen",
    operation: "increased",
  },
  "increased mana regen": {
    targetStat: "mana_regen",
    operation: "increased",
  },
  "health leech": { targetStat: "health_leech", operation: "add" },
  "movement speed": { targetStat: "movement_speed", operation: "add" },
  movespeed: { targetStat: "movement_speed", operation: "add" },
  "increased cooldown recovery speed": {
    targetStat: "cooldown_recovery_speed",
    operation: "add",
  },
  "cooldown recovery speed": {
    targetStat: "cooldown_recovery_speed",
    operation: "add",
  },

  // Ailments
  "bleed chance": { targetStat: "bleed_chance", operation: "add" },
  "poison chance": { targetStat: "poison_chance", operation: "add" },
  "ignite chance": { targetStat: "ignite_chance", operation: "add" },
  "ignite chance with fire skills": {
    targetStat: "ignite_chance",
    operation: "add",
  },
  "shock chance": { targetStat: "shock_chance", operation: "add" },
  "shock chance with lightning skills": {
    targetStat: "shock_chance",
    operation: "add",
  },
  "chill chance": { targetStat: "chill_chance", operation: "add" },
  "chill chance with cold skills": {
    targetStat: "ailment_chance",
    operation: "add",
  },
  "slow chance": { targetStat: "slow_chance", operation: "add" },
  "freeze rate": { targetStat: "freeze_rate", operation: "add" },
  "freeze rate multiplier": {
    targetStat: "freeze_rate_multiplier",
    operation: "add",
  },
  "increased stun chance": {
    targetStat: "stun_chance",
    operation: "add",
  },
  "armor shred chance": {
    targetStat: "armor_shred_chance",
    operation: "add",
  },

  // Penetration
  "fire penetration": {
    targetStat: "penetration_fire",
    operation: "add",
  },
  "cold penetration": {
    targetStat: "penetration_cold",
    operation: "add",
  },
  "lightning penetration": {
    targetStat: "penetration_lightning",
    operation: "add",
  },
  "physical penetration": {
    targetStat: "penetration_physical",
    operation: "add",
  },
  "necrotic penetration": {
    targetStat: "penetration_necrotic",
    operation: "add",
  },
  "void penetration": {
    targetStat: "penetration_void",
    operation: "add",
  },
  "elemental penetration": {
    targetStat: "penetration_elemental",
    operation: "add",
  },

  // Area
  area: { targetStat: "area", operation: "add" },
  "increased area": { targetStat: "area", operation: "add" },
};

/**
 * Parse a maxroll stat value string like "+1", "+3%", "-1%", "+10"
 * Returns the numeric value (strips % and +/- signs).
 */
export function parseStatValue(value: string): number {
  const cleaned = value.replace(/[+%]/g, "").trim();
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/**
 * Try to map a maxroll stat entry to our stat system.
 * Returns null if unmappable.
 */
export function mapStat(
  statName: string,
  value: string,
): StatMapping | null {
  const key = statName.toLowerCase().trim();

  // Some maxroll stat names are reused for both flat and percentage forms.
  // Use the value format to choose the correct semantic target.
  const isPercent = /%/.test(value);
  if (key === "lightning damage") {
    return isPercent
      ? { targetStat: "increased_lightning_damage", operation: "add" }
      : { targetStat: "added_spell_lightning_damage", operation: "add" };
  }
  if (key === "fire damage") {
    return isPercent
      ? { targetStat: "increased_fire_damage", operation: "add" }
      : { targetStat: "added_spell_fire_damage", operation: "add" };
  }
  if (key === "cold damage") {
    return isPercent
      ? { targetStat: "increased_cold_damage", operation: "add" }
      : { targetStat: "added_spell_cold_damage", operation: "add" };
  }

  return STAT_MAP[key] ?? null;
}

/**
 * Raw stat entry from maxroll data, preserved for tooltip display.
 */
export interface RawStat {
  statName: string;
  value: string;
  property: number;
  tags: number;
  mapped: boolean;
}
