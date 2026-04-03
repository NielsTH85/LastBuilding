/**
 * Adapter that converts uniques-import.json into a lookup map by uniqueID.
 * Also converts numeric property IDs to Modifier arrays for the calc engine.
 */

import type { UniqueItemDef, UniqueModDef } from "../types/item.js";
import type { StatId } from "../stats.js";
import type { Modifier } from "../modifiers.js";
import rawData from "./uniques-import.json" with { type: "json" };
import propertyNamesData from "./property-names.json" with { type: "json" };

interface RawUniqueMod {
  property: number;
  value: number;
  canRoll?: boolean;
  maxValue?: number;
  tags?: number;
  specialTag?: number;
  type?: number;
  hideInTooltip?: boolean;
}

interface RawUnique {
  uniqueID: number;
  name: string;
  displayName?: string;
  baseType: number;
  subTypes: number[];
  mods?: RawUniqueMod[];
  tooltipDescriptions?: string[];
  isSetItem?: boolean;
  setID?: number;
  levelRequirement?: number;
  legendaryType?: number;
  isPrimordialItem?: boolean;
  loreText?: string;
}

const raw = rawData as unknown as RawUnique[];
const propertyNames = propertyNamesData as Record<string, { name: string; pct?: boolean }>;

const FALLBACK_CANONICAL_STAT_MAP: Record<string, string> = {
  critical_strike_chance: "crit_chance",
  critical_chance: "crit_chance",
  crit_chance: "crit_chance",
  critical_strike_multiplier: "crit_multiplier",
  critical_multiplier: "crit_multiplier",
  crit_multiplier: "crit_multiplier",
  increased_area: "area",
  all_resistances: "fire_resistance",
  movement_speed: "movement_speed",
  cast_speed: "cast_speed",
  attack_speed: "attack_speed",
  more_damage: "more_damage",
  increased_damage: "increased_damage",
  spell_damage: "spell_damage",
};

function normalizeStatName(name: string): string {
  return name
    .toLowerCase()
    .replace(/[()%]/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
}

// ── Property ID → StatId mapping ───────────────────────────────────────────

interface PropertyMapping {
  /** Stat to use for flat (non-percentage) values */
  flatStat?: StatId;
  /** Stat to use for percentage values */
  pctStat?: StatId;
  /** If true, all values for this property are percentages (stored as 0.08 = 8%) */
  alwaysPct?: boolean;
}

const PROPERTY_MAP: Record<number, PropertyMapping> = {
  0: { flatStat: "damage", pctStat: "increased_damage" },
  1: { pctStat: "ailment_chance", alwaysPct: true },
  2: { pctStat: "attack_speed", alwaysPct: true },
  3: { pctStat: "cast_speed", alwaysPct: true },
  4: { pctStat: "crit_chance", alwaysPct: true },
  5: { pctStat: "crit_multiplier", alwaysPct: true },
  6: { pctStat: "less_damage_taken", alwaysPct: true },
  7: { flatStat: "health", pctStat: "health" },
  8: { flatStat: "mana", pctStat: "mana" },
  9: { pctStat: "movement_speed", alwaysPct: true },
  10: { flatStat: "armor", pctStat: "armor" },
  11: { flatStat: "dodge_rating", pctStat: "dodge_rating" },
  13: { pctStat: "fire_resistance", alwaysPct: true },
  14: { pctStat: "cold_resistance", alwaysPct: true },
  15: { pctStat: "lightning_resistance", alwaysPct: true },
  16: { pctStat: "ward_retention", alwaysPct: true },
  17: { flatStat: "health_regen", pctStat: "health_regen" },
  18: { flatStat: "mana_regen", pctStat: "mana_regen" },
  19: { flatStat: "strength" },
  20: { flatStat: "vitality" },
  21: { flatStat: "intelligence" },
  22: { flatStat: "dexterity" },
  23: { flatStat: "attunement" },
  26: { pctStat: "void_resistance", alwaysPct: true },
  27: { pctStat: "necrotic_resistance", alwaysPct: true },
  28: { pctStat: "poison_resistance", alwaysPct: true },
  29: { pctStat: "block_chance", alwaysPct: true },
  30: { pctStat: "fire_resistance", alwaysPct: true }, // All Res → simplified
  41: { flatStat: "spell_damage" },
  45: { pctStat: "stun_chance", alwaysPct: true },
  46: { flatStat: "strength" }, // All Attributes → simplified
  51: { pctStat: "health_leech", alwaysPct: true },
  52: { pctStat: "fire_resistance", alwaysPct: true }, // Elemental Res → simplified
  53: { flatStat: "block_effectiveness" },
  59: { pctStat: "penetration_elemental", alwaysPct: true },
  64: { pctStat: "physical_resistance", alwaysPct: true },
  66: { flatStat: "mana_cost" },
  67: { pctStat: "freeze_rate_multiplier", alwaysPct: true },
  69: { pctStat: "mana_efficiency", alwaysPct: true },
  70: { pctStat: "cooldown_recovery_speed", alwaysPct: true },
  75: { pctStat: "endurance", alwaysPct: true },
  76: { flatStat: "endurance_threshold" },
  92: { flatStat: "ward_generation" },
  102: { pctStat: "health_leech", alwaysPct: true }, // Increased Leech Rate → simplified
  116: { pctStat: "area", alwaysPct: true },
};

/**
 * Convert a single unique mod to a stat value.
 * Returns the resolved stat ID and numeric value, or null if unmappable.
 */
function resolveUniqueMod(
  mod: UniqueModDef,
  roll?: number,
): { statId: StatId; value: number } | null {
  let rawValue = mod.value;
  if (mod.canRoll && mod.maxValue != null && roll != null) {
    rawValue = mod.value + roll * (mod.maxValue - mod.value);
  }
  return resolvePropertyValue(mod.property, rawValue, mod.tags);
}

/**
 * Resolve a game property ID + raw value to a stat ID and display value.
 * Used by both unique mod resolution and blessing implicit resolution.
 */
export function resolvePropertyValue(
  property: number,
  rawValue: number,
  tags?: number,
): { statId: StatId; value: number } | null {
  // Template mod: increased cast speed per 2 intelligence.
  if (property === 98 && tags === 342) {
    return {
      statId: "cast_speed_per_2_intelligence",
      value: Math.round(rawValue * 1000) / 10,
    };
  }

  const mapping = PROPERTY_MAP[property];
  if (!mapping) {
    const propName = propertyNames[String(property)]?.name;
    const normalized = propName ? normalizeStatName(propName) : `property_${property}`;
    const canonical = FALLBACK_CANONICAL_STAT_MAP[normalized] ?? normalized;
    const isPct =
      Boolean(propertyNames[String(property)]?.pct) || (rawValue < 1 && rawValue > -1);
    const value = isPct ? Math.round(rawValue * 1000) / 10 : Math.round(rawValue * 10) / 10;
    return { statId: canonical as StatId, value };
  }

  const isPct = mapping.alwaysPct || (rawValue < 1 && rawValue > -1);
  const statId = isPct
    ? (mapping.pctStat ?? mapping.flatStat)
    : (mapping.flatStat ?? mapping.pctStat);
  if (!statId) return null;

  const value = isPct ? Math.round(rawValue * 1000) / 10 : Math.round(rawValue * 10) / 10;
  return { statId, value };
}

/**
 * Convert a unique item's mods into Modifier array for the calc engine.
 * @param uniqueId - The unique item's numeric ID
 * @param uniqueRolls - Optional roll values (0-1) from the maxroll build data
 */
export function convertUniqueMods(uniqueId: number, uniqueRolls?: number[]): Modifier[] {
  const def = uniqueItems.get(uniqueId);
  if (!def || !def.mods.length) return [];

  const modifiers: Modifier[] = [];

  for (const [i, mod] of def.mods.entries()) {
    const roll = uniqueRolls?.[i];
    const resolved = resolveUniqueMod(mod, roll);
    if (!resolved) continue;

    modifiers.push({
      id: `unique-${uniqueId}-mod-${i}`,
      sourceType: "item",
      sourceId: `unique-${uniqueId}`,
      targetStat: resolved.statId,
      operation: "add",
      value: resolved.value,
    });
  }

  return modifiers;
}

/** All unique item definitions, indexed by uniqueID. */
export const uniqueItems: Map<number, UniqueItemDef> = new Map(
  raw.map((u) => [
    u.uniqueID,
    {
      uniqueId: u.uniqueID,
      name: u.name,
      displayName: u.displayName || undefined,
      baseType: u.baseType,
      subTypes: u.subTypes,
      mods: (u.mods || []).map((m) => ({
        property: m.property,
        value: m.value,
        canRoll: m.canRoll,
        maxValue: m.maxValue,
        tags: m.tags ?? 0,
        specialTag: m.specialTag,
        type: m.type,
        hideInTooltip: m.hideInTooltip,
      })),
      isSetItem: u.isSetItem || undefined,
      setId: u.setID,
      levelRequirement: u.levelRequirement,
      legendaryType: u.legendaryType,
      isPrimordialItem: u.isPrimordialItem || undefined,
      loreText: u.loreText,
      tooltipDescriptions: u.tooltipDescriptions,
    },
  ]),
);

/** Look up a unique item by its numeric ID. */
export function getUniqueItem(uniqueId: number): UniqueItemDef | undefined {
  return uniqueItems.get(uniqueId);
}
