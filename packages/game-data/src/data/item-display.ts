/**
 * Display helpers for item tooltips — property names, unique mod descriptions, etc.
 */

import propertyData from "./property-names.json" with { type: "json" };
import type { UniqueModDef } from "../types/item.js";

const properties = propertyData as Record<string, { name: string; pct: boolean }>;

/** Get the human-readable name of a property by its numeric ID. */
export function getPropertyName(propertyId: number): string {
  return properties[String(propertyId)]?.name ?? `Unknown Property ${propertyId}`;
}

/** Whether a property should be displayed as a percentage. */
export function isPropertyPercentage(propertyId: number): boolean {
  return properties[String(propertyId)]?.pct ?? false;
}

// ── Tag bitmask enum (matches game data) ───────────────────────────────────

const TAG_DESCRIPTIONS: Record<number, string> = {
  1: "Physical",
  2: "Lightning",
  4: "Cold",
  8: "Fire",
  16: "Void",
  32: "Necrotic",
  64: "Poison",
  128: "Elemental",
  256: "Spell",
  512: "Melee",
  1024: "Throwing",
  2048: "Bow",
  4096: "DoT",
  8192: "Minion",
  16384: "Totem",
  8388608: "Hit",
};

// ── SpecialTag enum → ailment/effect names ─────────────────────────────────

const SPECIAL_TAG_NAMES: Record<number, string> = {
  1: "Ignite",
  2: "Bleed",
  3: "Chill",
  5: "Shock",
  6: "Slow",
  7: "Poison",
  8: "Shred Armor",
  9: "Time Rot",
  11: "Laceration",
  12: "Abyssal Decay",
  14: "Blind",
  15: "Serpent Venom",
  16: "Frailty",
  17: "Marked for Death",
  18: "Plague",
  19: "Ravage",
  20: "Root",
  21: "Fear",
  23: "Frostbite",
  24: "Spreading Flames",
  26: "Void Essence",
  28: "Poison Resistance Shred",
  29: "Necrotic Resistance Shred",
  30: "Void Resistance Shred",
  31: "Stagger",
  33: "Haste",
  34: "Frenzy",
  39: "Damned",
  40: "Pestilence",
  42: "Fire Resistance Shred",
  53: "Arcane Mark",
  55: "Spark Charge",
  58: "Bone Curse",
  59: "Spirit Plague",
  68: "Doom Brand",
  73: "Physical Resistance Shred",
  74: "Cold Resistance Shred",
  75: "Lightning Resistance Shred",
  93: "Electrify",
};

/**
 * Properties that are meta/container IDs in the game engine — their meaning
 * depends on internal templates we don't have access to.  Auto-generated text
 * for these is always wrong, so they should be hidden from display.
 * Items that use these typically have tooltipDescriptions covering the effect.
 */
const COMPLEX_PROPERTIES = new Set([42, 46, 53, 98, 100]);

/** Whether a property is a complex meta-property that can't produce accurate display text. */
export function isComplexProperty(propertyId: number): boolean {
  return COMPLEX_PROPERTIES.has(propertyId);
}

/**
 * Some complex/meta mods can still be rendered accurately from tag templates.
 * Keep these visible even when we suppress most complex properties.
 */
export function hasComplexDisplayOverride(mod: Pick<UniqueModDef, "property" | "tags">): boolean {
  return (
    mod.property === 98 &&
    (mod.tags === 342 ||
      mod.tags === 343 ||
      mod.tags === 566 ||
      mod.tags === 567 ||
      mod.tags === 568)
  );
}

export interface UniqueModDisplay {
  text: string;
  value: number;
  minValue: number;
  maxValue: number;
  isPercentage: boolean;
  hideInTooltip?: boolean;
}

/**
 * Convert game tooltip templates like "[5,12,0]%" to a readable range.
 * The 3rd value in the tuple is game-internal and not needed for display.
 */
export function formatTooltipDescription(text: string): string {
  let formatted = text.replace(
    /\[\s*(-?\d+(?:\.\d+)?)\s*,\s*(-?\d+(?:\.\d+)?)\s*,\s*-?\d+(?:\.\d+)?\s*\]/g,
    (_m, minRaw, maxRaw) => {
      const min = Number(minRaw);
      const max = Number(maxRaw);
      const fmt = (v: number) => {
        if (Number.isInteger(v)) return String(v);
        return String(Math.round(v * 1000) / 1000);
      };
      if (Math.abs(min - max) < 1e-9) return fmt(min);
      return `${fmt(min)} to ${fmt(max)}`;
    },
  );

  // Remove internal character-level template annotations like "([1,c])".
  formatted = formatted.replace(
    /\(\[\s*-?\d+(?:\.\d+)?\s*,\s*c(?:\s*,\s*-?\d+(?:\.\d+)?)?\s*\]%?\)/gi,
    "",
  );

  return formatted.replace(/\s{2,}/g, " ").trim();
}

/** Decode tag bitmask into a list of tag names. */
function getTagNames(tags: number): string[] {
  if (!tags) return [];
  const parts: string[] = [];
  for (const [bit, desc] of Object.entries(TAG_DESCRIPTIONS)) {
    if (tags & Number(bit)) parts.push(desc);
  }
  return parts;
}

/**
 * Get display info for a unique mod.
 *
 * Logic:
 * - type=0 (flat): "+{val} PropName" or "+{val}% PropName" if property is pct
 * - type=1 (increased): "+{val}% increased PropName"
 * - type=2 (more): "+{val}% more PropName"
 * - specialTag: replaces generic "Ailment Chance" with specific name like "Ignite Chance"
 * - tags: appended as "on Spell Hit", "on Melee", etc.
 * - property 88 (Level of Skills): "+X to {tags} Skills"
 */
export function getUniqueModDisplay(mod: UniqueModDef, roll?: number): UniqueModDisplay {
  const modType = mod.type ?? 0;

  // Calculate actual value
  let actualValue = mod.value;
  if (mod.canRoll && mod.maxValue != null && roll != null) {
    actualValue = mod.value + roll * (mod.maxValue - mod.value);
  }
  const minVal = mod.value;
  const maxVal = mod.canRoll && mod.maxValue != null ? mod.maxValue : mod.value;

  // ── Special case: Mad Alchemist's Ladle template mods ──
  // These are encoded as generic container properties/tags in game data.
  if (mod.property === 117 && mod.tags === 256 && mod.specialTag === 26 && modType === 2) {
    const v = Math.round(actualValue * 1000) / 10;
    const vMin = Math.round(minVal * 1000) / 10;
    const vMax = Math.round(maxVal * 1000) / 10;
    return {
      text: `+${v}% more Spell Damage per Negative Ailment on the Target (up to 8)`,
      value: v,
      minValue: vMin,
      maxValue: vMax,
      isPercentage: true,
      hideInTooltip: mod.hideInTooltip,
    };
  }

  if (mod.property === 98 && mod.tags === 342) {
    const v = Math.round(actualValue * 100) / 100;
    const vMin = Math.round(minVal * 100) / 100;
    const vMax = Math.round(maxVal * 100) / 100;
    return {
      text: `+${v} increased Cast Speed per 2 Intelligence`,
      value: v,
      minValue: vMin,
      maxValue: vMax,
      isPercentage: false,
      hideInTooltip: mod.hideInTooltip,
    };
  }

  if (mod.property === 98 && mod.tags === 343) {
    const v = Math.round(actualValue * 10) / 10;
    const vMin = Math.round(minVal * 10) / 10;
    const vMax = Math.round(maxVal * 10) / 10;
    return {
      text: `${v} Mana gained on Potion Use per 4 Intelligence`,
      value: v,
      minValue: vMin,
      maxValue: vMax,
      isPercentage: false,
      hideInTooltip: mod.hideInTooltip,
    };
  }

  // ── Special case: property 98 set templates used by Legends Entwined ──
  if (mod.property === 98) {
    const fmtValue = (v: number) => {
      if (Math.abs(v) >= 1) return String(Math.round(v * 10) / 10);
      return String(Math.round(v * 1000) / 1000);
    };
    const v = fmtValue(actualValue);
    const vMin = Number(fmtValue(minVal));
    const vMax = Number(fmtValue(maxVal));

    if (mod.tags === 566) {
      return {
        text: `+${v} to All Attributes per Complete Set`,
        value: Number(v),
        minValue: vMin,
        maxValue: vMax,
        isPercentage: false,
        hideInTooltip: mod.hideInTooltip,
      };
    }
    if (mod.tags === 567) {
      return {
        text: `+${v} to All Resistances per Complete Set`,
        value: Number(v),
        minValue: vMin,
        maxValue: vMax,
        isPercentage: false,
        hideInTooltip: mod.hideInTooltip,
      };
    }
    if (mod.tags === 568) {
      return {
        text: `+${v} to All Skills per Complete Set`,
        value: Number(v),
        minValue: vMin,
        maxValue: vMax,
        isPercentage: false,
        hideInTooltip: mod.hideInTooltip,
      };
    }
  }

  // ── Special case: property 88 = Level of Skills ──
  if (mod.property === 88) {
    const tagNames = getTagNames(mod.tags);
    const skillType = tagNames.length > 0 ? tagNames.join(" ") + " " : "";
    const v = Math.round(actualValue * 10) / 10;
    const vMin = Math.round(minVal * 10) / 10;
    const vMax =
      Math.round((mod.canRoll && mod.maxValue != null ? mod.maxValue : minVal) * 10) / 10;
    return {
      text: `+${v} to ${skillType}Skills`,
      value: v,
      minValue: vMin,
      maxValue: vMax,
      isPercentage: false,
      hideInTooltip: mod.hideInTooltip,
    };
  }

  // Determine if displayed as percentage:
  // - type=1 (increased) or type=2 (more) always show as %
  // - type=0: use property's pct flag
  const isPropPct = isPropertyPercentage(mod.property);
  const isPercentage = modType !== 0 || isPropPct;

  // Format values (fractions → display percentages)
  const fmt = (v: number) => (isPercentage ? Math.round(v * 1000) / 10 : Math.round(v * 10) / 10);

  const displayVal = fmt(actualValue);
  const displayMin = fmt(minVal);
  const displayMax = fmt(maxVal);

  // Build property name
  let propName = getPropertyName(mod.property);

  // Replace generic "Ailment Chance" with specific ailment from specialTag
  if (mod.specialTag && mod.specialTag > 0) {
    const ailmentName = SPECIAL_TAG_NAMES[mod.specialTag];
    if (ailmentName) {
      if (propName === "Ailment Chance") {
        propName = `Chance to ${ailmentName}`;
      } else {
        propName = `${propName} (${ailmentName})`;
      }
    }
  }

  // Build tag suffix
  const tagNames = getTagNames(mod.tags);
  const tagSuffix = tagNames.length > 0 ? ` on ${tagNames.join(" ")}` : "";

  // Build prefix based on type, avoiding redundancy with property name
  const sign = displayVal >= 0 ? "+" : "";
  const unit = isPercentage ? "%" : "";
  let typePrefix = "";
  if (modType === 1 && !propName.toLowerCase().startsWith("increased")) {
    typePrefix = " increased";
  }
  if (modType === 2 && !propName.toLowerCase().startsWith("more")) {
    typePrefix = " more";
  }

  const text = `${sign}${displayVal}${unit}${typePrefix} ${propName}${tagSuffix}`;

  return {
    text,
    value: displayVal,
    minValue: displayMin,
    maxValue: displayMax,
    isPercentage,
    hideInTooltip: mod.hideInTooltip,
  };
}
