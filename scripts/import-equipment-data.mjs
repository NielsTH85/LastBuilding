#!/usr/bin/env node
/**
 * Import equipment (item bases + affixes) from maxroll-game-data.json
 * into a structured JSON for the game-data package.
 *
 * Usage:  node scripts/import-equipment-data.mjs
 * Output: packages/game-data/src/data/equipment-import.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_PATH = resolve(ROOT, "maxroll-game-data.json");
const OUT_PATH = resolve(ROOT, "packages/game-data/src/data/equipment-import.json");

const raw = JSON.parse(readFileSync(RAW_PATH, "utf-8"));

// ── Property ID → readable name ─────────────────────────────────────────────

const PROPERTY_NAMES = {};
for (const [id, prop] of Object.entries(raw.properties)) {
  PROPERTY_NAMES[Number(id)] = prop.propertyName;
}

// ── Class requirement bitmask → class IDs ────────────────────────────────────

const CLASS_BITS = { 1: "primalist", 2: "mage", 4: "sentinel", 8: "acolyte", 16: "rogue" };

function classFromBitmask(mask) {
  if (!mask) return undefined;
  // If exactly one class, return it
  const classes = [];
  for (const [bit, id] of Object.entries(CLASS_BITS)) {
    if (mask & Number(bit)) classes.push(id);
  }
  return classes.length === 1 ? classes[0] : classes.length > 1 ? classes : undefined;
}

// ── BaseTypeID → equipment slot ──────────────────────────────────────────────

const ITEM_TYPE_TO_SLOT = {
  0: "helmet",
  1: "bodyArmor",
  2: "belt",
  3: "boots",
  4: "gloves",
  5: "weapon1",   // 1H Axes
  6: "weapon1",   // 1H Dagger
  7: "weapon1",   // 1H Maces
  8: "weapon1",   // 1H Scepter
  9: "weapon1",   // 1H Swords
  10: "weapon1",  // Wands
  12: "weapon1",  // 2H Axes
  13: "weapon1",  // 2H Maces
  14: "weapon1",  // 2H Polearm
  15: "weapon1",  // 2H Staff
  16: "weapon1",  // 2H Swords
  17: "weapon2",  // Quiver
  18: "weapon2",  // Shield
  19: "weapon2",  // Catalyst
  20: "amulet",
  21: "ring1",
  22: "relic",
  23: "weapon1",  // Bows
  25: "idol",
  26: "idol",
  27: "idol",
  28: "idol",
  29: "idol",
  30: "idol",
  31: "idol",
  32: "idol",
  33: "idol",
  41: "idolAltar",
};

// Equipment and idol/altar types that feed planner data and sprite extraction.
const EQUIPMENT_TYPE_IDS = Object.keys(ITEM_TYPE_TO_SLOT).map(Number);

// ── Modifier type mapping ────────────────────────────────────────────────────

function operationFromModType(modType) {
  switch (modType) {
    case 1: return "increase";
    case 2: return "more";
    default: return "add";
  }
}

// ── Stat name from property ID ───────────────────────────────────────────────

function statNameFromProperty(propertyId) {
  const name = PROPERTY_NAMES[propertyId];
  if (!name) return `property_${propertyId}`;
  return name
    .toLowerCase()
    .replace(/[()]/g, "")
    .replace(/\s+/g, "_");
}

// ── Import item bases ────────────────────────────────────────────────────────

function importItemBases() {
  const items = [];

  for (const typeId of EQUIPMENT_TYPE_IDS) {
    const itemType = raw.itemTypes[String(typeId)];
    if (!itemType || !itemType.subItems) continue;

    const typeName = itemType.BaseTypeName;
    const isWeapon = itemType.isWeapon;
    const isTwoHanded = [12, 13, 14, 15, 16, 23].includes(typeId);

    for (const sub of itemType.subItems) {
      // Use displayName if it exists and is non-empty, otherwise name
      const name = (sub.displayName || sub.name || "").trim();
      if (!name) continue;

      const slot = ITEM_TYPE_TO_SLOT[typeId];
      const classReq = classFromBitmask(sub.classRequirement);

      // Build tags
      const tags = [typeName.toLowerCase().replace(/\s+/g, "-")];
      if (isWeapon) tags.push("weapon");
      if (isTwoHanded) tags.push("two-handed");
      else if (isWeapon) tags.push("one-handed");
      if (typeId >= 25 && typeId <= 33) tags.push("idol");
      if (typeId === 41) tags.push("idol-altar");

      // Convert implicits
      const implicits = [];
      for (const imp of sub.implicits || []) {
        const stat = statNameFromProperty(imp.property);
        implicits.push({
          property: imp.property,
          propertyName: PROPERTY_NAMES[imp.property] || `property_${imp.property}`,
          stat,
          operation: operationFromModType(imp.type),
          value: imp.implicitValue,
          maxValue: imp.implicitMaxValue,
          tags: imp.tags,
          specialTag: imp.specialTag,
        });
      }

      items.push({
        baseTypeId: typeId,
        subTypeId: sub.subTypeID,
        name,
        typeName,
        slot,
        levelRequirement: sub.levelRequirement || 0,
        classRequirement: typeof classReq === "string" ? classReq : undefined,
        classRequirements: Array.isArray(classReq) ? classReq : undefined,
        implicits,
        tags,
        attackRate: isWeapon ? sub.attackRate : undefined,
        addedWeaponRange: isWeapon && sub.addedWeaponRange ? sub.addedWeaponRange : undefined,
      });
    }
  }

  return items;
}

// ── Import affixes ───────────────────────────────────────────────────────────

function importAffixes() {
  const affixList = [];

  for (const [key, affix] of Object.entries(raw.affixes)) {
    // Only import normal affixes (skip experimental, set, idol-specific, etc.)
    if (affix.specialAffixType !== 0) continue;

    // Only affixes that can roll on equipment we care about
    const relevantSlots = (affix.canRollOn || []).filter((id) =>
      EQUIPMENT_TYPE_IDS.includes(id)
    );
    if (relevantSlots.length === 0) continue;

    const isCompound = affix.affixProperties && affix.affixProperties.length > 0;
    const type = affix.type === 1 ? "suffix" : "prefix";

    // Build properties list
    const properties = [];
    if (isCompound) {
      for (const ap of affix.affixProperties) {
        properties.push({
          property: ap.property,
          propertyName: PROPERTY_NAMES[ap.property] || `property_${ap.property}`,
          stat: statNameFromProperty(ap.property),
          operation: operationFromModType(ap.modifierType),
        });
      }
    } else {
      properties.push({
        property: affix.property,
        propertyName: PROPERTY_NAMES[affix.property] || `property_${affix.property}`,
        stat: statNameFromProperty(affix.property),
        operation: operationFromModType(affix.modifierType),
      });
    }

    // Convert tiers (T1-T5 = normal, T6 = exalted T1, T7 = exalted T2 etc.)
    const tiers = affix.tiers.map((t, i) => {
      const tier = {
        tier: i + 1,
        minValue: t.minRoll,
        maxValue: t.maxRoll,
      };
      // Add extra rolls for compound affixes
      if (t.extraRolls && t.extraRolls.length > 0) {
        tier.extraRolls = t.extraRolls.map((er) => ({
          minValue: er.minRoll,
          maxValue: er.maxRoll,
        }));
      }
      return tier;
    });

    // Map canRollOn to slot names
    const canRollOnSlots = [...new Set(relevantSlots.map((id) => ITEM_TYPE_TO_SLOT[id]))];

    // Class specificity
    const classSpec = classFromBitmask(affix.classSpecificity);

    affixList.push({
      affixId: affix.affixId,
      name: affix.affixName,
      displayName: affix.affixDisplayName || undefined,
      title: affix.affixTitle,
      type,
      levelRequirement: affix.levelRequirement || 0,
      properties,
      tiers,
      canRollOn: relevantSlots,
      canRollOnSlots,
      classRequirement: typeof classSpec === "string" ? classSpec : undefined,
      classRequirements: Array.isArray(classSpec) ? classSpec : undefined,
      group: affix.group,
    });
  }

  return affixList;
}

// ── Main ─────────────────────────────────────────────────────────────────────

const itemBases = importItemBases();
const affixes = importAffixes();

const output = {
  itemBases,
  affixes,
  meta: {
    totalItemBases: itemBases.length,
    totalAffixes: affixes.length,
    itemsBySlot: {},
    affixesByType: { prefix: 0, suffix: 0 },
  },
};

// Stats
for (const item of itemBases) {
  output.meta.itemsBySlot[item.slot] = (output.meta.itemsBySlot[item.slot] || 0) + 1;
}
for (const a of affixes) {
  output.meta.affixesByType[a.type]++;
}

writeFileSync(OUT_PATH, JSON.stringify(output, null, 2));

console.log(`Equipment data imported successfully!`);
console.log(`  Item bases: ${itemBases.length}`);
console.log(`  Affixes: ${affixes.length} (${output.meta.affixesByType.prefix} prefix, ${output.meta.affixesByType.suffix} suffix)`);
console.log(`  Items by slot:`, output.meta.itemsBySlot);
console.log(`  Output: ${OUT_PATH}`);
