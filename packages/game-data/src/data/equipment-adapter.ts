/**
 * Adapter that converts equipment-import.json into typed ItemBaseDef[] and AffixDef[].
 */

import type {
  ItemBaseDef,
  AffixDef,
  AffixTier,
  ItemSlot,
  ImplicitDisplay,
  AffixAdditionalProperty,
} from "../types/item.js";
import type { Modifier, ModifierOperation } from "../modifiers.js";
import type { StatId } from "../stats.js";
import { STAT_ID_SET } from "../stats.js";
import { getPropertyName, isPropertyPercentage } from "./item-display.js";
import importedData from "./equipment-import.json" with { type: "json" };

// ── Types for the imported JSON ────────────────────────────────────────────

interface ImportedImplicit {
  property: number;
  propertyName: string;
  stat: string;
  operation: string;
  value: number;
  maxValue: number;
  tags: number;
  specialTag: number;
}

interface ImportedItemBase {
  baseTypeId: number;
  subTypeId: number;
  name: string;
  typeName: string;
  slot: string;
  levelRequirement: number;
  classRequirement?: string;
  classRequirements?: string[];
  implicits: ImportedImplicit[];
  tags: string[];
  attackRate?: number;
  addedWeaponRange?: number;
}

interface ImportedAffixProperty {
  property: number;
  propertyName: string;
  stat: string;
  operation: string;
}

interface ImportedAffixTier {
  tier: number;
  minValue: number;
  maxValue: number;
  extraRolls?: { minValue: number; maxValue: number }[];
}

interface ImportedAffix {
  affixId: number;
  name: string;
  displayName?: string;
  title: string;
  type: "prefix" | "suffix";
  levelRequirement: number;
  properties: ImportedAffixProperty[];
  tiers: ImportedAffixTier[];
  canRollOn: number[];
  canRollOnSlots: string[];
  classRequirement?: string;
  classRequirements?: string[];
  group: number;
}

// ── Property name → StatId mapping ─────────────────────────────────────────
// Maps the property names from the game data to our internal stat IDs.

const PROPERTY_TO_STAT: Record<string, StatId> = {
  damage: "melee_damage",
  health: "health",
  mana: "mana",
  armor: "armor",
  dodge_rating: "dodge_rating",
  stun_avoidance: "armor", // approximate
  fire_resistance: "fire_resistance",
  cold_resistance: "cold_resistance",
  lightning_resistance: "lightning_resistance",
  void_resistance: "void_resistance",
  necrotic_resistance: "necrotic_resistance",
  poison_resistance: "poison_resistance",
  physical_resistance: "physical_resistance",
  health_regen: "health_regen",
  mana_regen: "mana_regen",
  mana_cost: "mana_cost",
  mana_efficiency: "mana_efficiency",
  strength: "strength",
  vitality: "vitality",
  intelligence: "intelligence",
  dexterity: "dexterity",
  attunement: "attunement",
  attack_speed: "attack_speed",
  cast_speed: "cast_speed",
  critical_strike_chance: "crit_chance",
  critical_strike_multiplier: "crit_multiplier",
  movement_speed: "movement_speed",
  ward_retention: "ward_retention",
  ward_per_second: "ward_generation",
  block_chance: "block_chance",
  block_effectiveness: "block_effectiveness",
  adaptive_spell_damage: "spell_damage",
  ailment_chance: "ailment_chance",
  increased_stun_chance: "stun_chance",
  endurance: "endurance",
  endurance_threshold: "endurance_threshold",
  all_resistances: "fire_resistance", // simplified
  elemental_resistance: "fire_resistance", // simplified
  damage_taken: "less_damage_taken",
  chance_to_receive_a_glancing_blow_when_hit: "glancing_blow_chance",
  freeze_rate_multiplier: "freeze_rate_multiplier",
  increased_cooldown_recovery_speed: "cooldown_recovery_speed",
  damage_leeched_as_health: "health_leech",
  all_attributes: "strength", // simplified - first attribute
  ward_gain: "ward",
  ward_gained: "ward_gained",
  penetration: "penetration_elemental",
};

function resolveStatId(stat: string): string {
  // Direct match in our stat registry
  if (STAT_ID_SET.has(stat)) return stat;
  // Look up in property mapping
  if (PROPERTY_TO_STAT[stat]) return PROPERTY_TO_STAT[stat];

  // Preserve unknown stats so affixes are not silently dropped.
  // This keeps calculation coverage complete while we incrementally add
  // canonical StatId mappings for newly discovered game stats.
  return stat.toLowerCase().trim().replace(/\s+/g, "_");
}

function resolveOperation(op: string): ModifierOperation {
  switch (op) {
    case "increase":
      return "increased";
    case "more":
      return "more";
    default:
      return "add";
  }
}

function inferDamageIncreaseTargetStat(context: string): StatId {
  const text = context.toLowerCase();
  if (text.includes("spell")) return "increased_spell_damage";
  if (text.includes("lightning")) return "increased_lightning_damage";
  if (text.includes("fire")) return "increased_fire_damage";
  if (text.includes("cold")) return "increased_cold_damage";
  if (text.includes("elemental")) return "increased_elemental_damage";
  if (text.includes("physical")) return "increased_physical_damage";
  if (text.includes("melee")) return "increased_melee_damage";
  if (text.includes("void")) return "increased_void_damage";
  if (text.includes("necrotic")) return "increased_necrotic_damage";
  if (text.includes("poison")) return "increased_poison_damage";
  if (text.includes("minion")) return "increased_minion_damage";
  if (text.includes("throwing")) return "increased_throwing_damage";
  return "increased_damage";
}

function inferPenetrationTargetStat(context: string): StatId {
  const text = context.toLowerCase();
  if (text.includes("lightning")) return "penetration_lightning";
  if (text.includes("fire")) return "penetration_fire";
  if (text.includes("cold")) return "penetration_cold";
  if (text.includes("physical")) return "penetration_physical";
  if (text.includes("void")) return "penetration_void";
  if (text.includes("necrotic")) return "penetration_necrotic";
  if (text.includes("elemental")) return "penetration_elemental";
  return "penetration_elemental";
}

function resolveAffixPropertyStat(
  affixName: string,
  propertyName: string,
  rawStat: string,
  rawOperation: string,
): string {
  if (rawStat === "damage" && rawOperation === "increase") {
    return inferDamageIncreaseTargetStat(`${affixName} ${propertyName}`);
  }
  if (rawStat === "penetration") {
    return inferPenetrationTargetStat(`${affixName} ${propertyName}`);
  }
  return resolveStatId(rawStat);
}

// ── Convert item bases ─────────────────────────────────────────────────────

function convertItemBase(item: ImportedItemBase): ItemBaseDef {
  const itemId = `${item.slot}-${item.baseTypeId}-${item.subTypeId}`;

  const implicits: Modifier[] = [];
  const implicitDisplays: ImplicitDisplay[] = [];
  for (const imp of item.implicits) {
    const statId = resolveStatId(imp.stat);

    implicitDisplays.push({
      propertyName: getPropertyName(imp.property),
      value: imp.value,
      maxValue: imp.maxValue,
      displayAsPercentage: isPropertyPercentage(imp.property),
    });

    if (!statId) continue; // Skip unmapped stats for calc, but keep display

    implicits.push({
      id: `${itemId}-impl-${imp.stat}`,
      sourceType: "implicit",
      sourceId: itemId,
      targetStat: statId as Modifier["targetStat"],
      operation: resolveOperation(imp.operation),
      value: imp.value,
    });
  }

  return {
    id: itemId,
    name: item.name,
    slot: item.slot as ItemSlot,
    levelRequirement: item.levelRequirement,
    classRequirement: item.classRequirement,
    typeName: item.typeName,
    attackRate: item.attackRate,
    weaponRange: item.addedWeaponRange != null ? 1.9 + item.addedWeaponRange : undefined,
    implicits,
    implicitDisplays,
    tags: item.tags,
  };
}

// ── Convert affixes ────────────────────────────────────────────────────────

function convertAffix(affix: ImportedAffix): AffixDef | null {
  // Use the first property as primary; preserve all additional properties.
  const primary = affix.properties[0];
  if (!primary) return null;

  const primaryStatId = resolveAffixPropertyStat(
    affix.name,
    primary.propertyName,
    primary.stat,
    primary.operation,
  );

  const tiers: AffixTier[] = affix.tiers.map((t) => ({
    tier: t.tier,
    minValue: t.minValue,
    maxValue: t.maxValue,
    levelRequirement: affix.levelRequirement,
    extraRolls: t.extraRolls?.map((r) => ({ minValue: r.minValue, maxValue: r.maxValue })),
  }));

  const additionalProperties: AffixAdditionalProperty[] = affix.properties
    .slice(1)
    .map((p, idx) => ({
      targetStat: resolveAffixPropertyStat(affix.name, p.propertyName, p.stat, p.operation),
      operation: resolveOperation(p.operation),
      extraRollIndex: idx,
    }));

  const tags: string[] = [];
  if (affix.classRequirement) tags.push(affix.classRequirement);
  tags.push(...affix.canRollOnSlots);

  return {
    id: `affix-${affix.affixId}`,
    name: affix.name,
    type: affix.type,
    targetStat: primaryStatId,
    operation: resolveOperation(primary.operation),
    tiers,
    tags,
    additionalProperties: additionalProperties.length > 0 ? additionalProperties : undefined,
  };
}

// ── Build exported data ────────────────────────────────────────────────────

const data = importedData as unknown as {
  itemBases: ImportedItemBase[];
  affixes: ImportedAffix[];
};

const SUPPLEMENTAL_AFFIXES: AffixDef[] = [
  {
    id: "affix-698",
    name: "Julra's",
    type: "prefix",
    targetStat: "damage",
    operation: "add",
    tiers: [
      {
        tier: 1,
        minValue: 2,
        maxValue: 2,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.04, maxValue: 0.05 }],
      },
      {
        tier: 2,
        minValue: 3,
        maxValue: 3,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.06, maxValue: 0.07 }],
      },
      {
        tier: 3,
        minValue: 4,
        maxValue: 4,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.08, maxValue: 0.1 }],
      },
      {
        tier: 4,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.11, maxValue: 0.13 }],
      },
      {
        tier: 5,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.14, maxValue: 0.16 }],
      },
      {
        tier: 6,
        minValue: 8,
        maxValue: 8,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.18, maxValue: 0.2 }],
      },
      {
        tier: 7,
        minValue: 9,
        maxValue: 10,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.21, maxValue: 0.25 }],
      },
      {
        tier: 8,
        minValue: 16,
        maxValue: 20,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.4, maxValue: 0.5 }],
      },
    ],
    tags: ["amulet"],
    additionalProperties: [
      { targetStat: "julra_experimental_scalar", operation: "add", extraRollIndex: 0 },
    ],
  },
  {
    id: "affix-1070",
    name: "All Resistances for you and your Minions",
    type: "prefix",
    targetStat: "fire_resistance",
    operation: "add",
    tiers: [
      {
        tier: 1,
        minValue: 0.008,
        maxValue: 0.008,
        levelRequirement: 0,
        extraRolls: [{ minValue: 0.008, maxValue: 0.008 }],
      },
    ],
    tags: ["idol"],
    additionalProperties: [{ targetStat: "fire_resistance", operation: "add", extraRollIndex: 0 }],
  },
  {
    id: "affix-1078",
    name: "Added Intelligence and Ward Decay Threshold per Intelligence",
    type: "prefix",
    targetStat: "intelligence",
    operation: "add",
    tiers: [
      {
        tier: 1,
        minValue: 4,
        maxValue: 4,
        levelRequirement: 0,
        extraRolls: [{ minValue: 2, maxValue: 2 }],
      },
      {
        tier: 2,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 2, maxValue: 2 }],
      },
      {
        tier: 3,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 3, maxValue: 3 }],
      },
      {
        tier: 4,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 3, maxValue: 3 }],
      },
      {
        tier: 5,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 3, maxValue: 3 }],
      },
      {
        tier: 6,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 4, maxValue: 4 }],
      },
      {
        tier: 7,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 4, maxValue: 4 }],
      },
      {
        tier: 8,
        minValue: 10,
        maxValue: 12,
        levelRequirement: 0,
        extraRolls: [{ minValue: 6, maxValue: 7 }],
      },
    ],
    tags: ["weapon2"],
    additionalProperties: [
      { targetStat: "ward_decay_threshold_per_intelligence", operation: "add", extraRollIndex: 0 },
    ],
  },
  {
    id: "affix-1085",
    name: "Dexterity converted to Guile",
    type: "prefix",
    targetStat: "dexterity",
    operation: "add",
    tiers: [
      {
        tier: 1,
        minValue: 4,
        maxValue: 4,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 2,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 3,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 4,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 5,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 6,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 7,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 8,
        minValue: 10,
        maxValue: 12,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
    ],
    tags: ["amulet"],
    additionalProperties: [
      { targetStat: "guile_from_dexterity", operation: "add", extraRollIndex: 0 },
    ],
  },
  {
    id: "affix-1086",
    name: "Attunement converted to Apathy",
    type: "prefix",
    targetStat: "attunement",
    operation: "add",
    tiers: [
      {
        tier: 1,
        minValue: 4,
        maxValue: 4,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 2,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 3,
        minValue: 5,
        maxValue: 5,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 4,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 5,
        minValue: 6,
        maxValue: 6,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 6,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 7,
        minValue: 7,
        maxValue: 7,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
      {
        tier: 8,
        minValue: 10,
        maxValue: 12,
        levelRequirement: 0,
        extraRolls: [{ minValue: 1, maxValue: 1 }],
      },
    ],
    tags: ["amulet"],
    additionalProperties: [
      { targetStat: "apathy_from_attunement", operation: "add", extraRollIndex: 0 },
    ],
  },
];

/** All item bases from the game data. */
export const itemBases: ItemBaseDef[] = data.itemBases.map(convertItemBase);

/** All affixes from the game data. */
export const affixes: AffixDef[] = data.affixes
  .map(convertAffix)
  .filter((a): a is AffixDef => a !== null)
  .concat(SUPPLEMENTAL_AFFIXES);
