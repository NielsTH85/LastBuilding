/**
 * Import builds from maxroll.gg share links.
 *
 * API endpoint: https://planners.maxroll.gg/profiles/last-epoch/{id}
 * The response contains a JSON `data` string with profiles, items, skill trees, etc.
 */

import importedData from "./maxroll-import.json" with { type: "json" };
import equipmentData from "./equipment-import.json" with { type: "json" };
import blessingData from "./blessings-import.json" with { type: "json" };
import { affixes } from "./affixes.js";
import type { ItemSlot, ItemRarity } from "../types/item.js";
import type { Modifier } from "../modifiers.js";
import { getUniqueItem, convertUniqueMods, resolvePropertyValue } from "./uniques-adapter.js";

// ── Maxroll API response types ─────────────────────────────────────────────

export interface MaxrollApiResponse {
  id: string;
  name: string;
  class: string;
  data: string; // JSON-encoded MaxrollBuildData
}

export interface MaxrollBuildData {
  profiles: MaxrollProfile[];
  items: Record<string, MaxrollItem>;
  activeProfile: number;
}

export interface MaxrollProfile {
  name: string;
  class: number;
  mastery: number;
  level: number;
  items: Record<string, number>; // slot -> item index
  activeSkills: string[]; // abilityKey[]
  specializedSkills: string[]; // abilityKey[]
  skillTrees: Record<string, MaxrollTreeHistory>; // treeKey -> history
  passives: MaxrollTreeHistory;
  idols: (number | null)[];
  blessings: (MaxrollBlessingEntry | null)[];
  weaver: MaxrollTreeHistory;
}

export interface MaxrollTreeHistory {
  history: number[];
  position: number;
}

export interface MaxrollItem {
  itemType: number;
  subType: number;
  uniqueID?: number;
  uniqueRolls?: number[];
  affixes: MaxrollAffix[];
  implicits?: number[];
  sealedAffix?: MaxrollAffix;
  corruptedAffix?: MaxrollAffix;
}

export interface MaxrollAffix {
  id: number;
  tier: number;
  roll: number;
}

export interface MaxrollBlessingEntry {
  itemType: number;
  subType: number;
  implicits: number[];
}

// ── Equipment mapping ──────────────────────────────────────────────────────

/** Map maxroll profile slot names to our ItemSlot type. */
const MAXROLL_SLOT_TO_OURS: Record<string, ItemSlot> = {
  weapon: "weapon1",
  hands: "gloves",
  head: "helmet",
  neck: "amulet",
  offhand: "weapon2",
  waist: "belt",
  finger1: "ring1",
  finger2: "ring2",
  feet: "boots",
  relic: "relic",
  body: "bodyArmor",
};

interface ImportedItemBase {
  baseTypeId: number;
  subTypeId: number;
  slot: string;
}

interface ImportedAffix {
  affixId: number;
  tiers: { tier: number; minValue: number; maxValue: number }[];
}

const eqData = equipmentData as unknown as {
  itemBases: ImportedItemBase[];
  affixes: ImportedAffix[];
};

/** Lookup: "baseTypeId-subTypeId" → slot string from our data. */
const itemBaseLookup = new Map<string, string>();
for (const item of eqData.itemBases) {
  itemBaseLookup.set(`${item.baseTypeId}-${item.subTypeId}`, item.slot);
}

/** Lookup: affix numeric ID → tier data. */
const affixTierLookup = new Map<number, ImportedAffix["tiers"]>();
for (const affix of eqData.affixes) {
  affixTierLookup.set(affix.affixId, affix.tiers);
}

// ── Blessing data lookup ───────────────────────────────────────────────────

interface BlessingImplicit {
  property: number;
  tags: number;
  specialTag: number;
  type: number;
  minValue: number;
  maxValue: number;
}

interface BlessingDef {
  subType: number;
  displayName: string;
  implicits: BlessingImplicit[];
}

const blessingLookup = new Map<number, BlessingDef>();
for (const b of blessingData as BlessingDef[]) {
  blessingLookup.set(b.subType, b);
}

/** Convert a maxroll blessing entry to Modifier array. */
function convertBlessingToModifiers(
  entry: MaxrollBlessingEntry,
): Modifier[] {
  const def = blessingLookup.get(entry.subType);
  if (!def) return [];

  const modifiers: Modifier[] = [];
  for (const [i, imp] of def.implicits.entries()) {
    const roll = entry.implicits[i] ?? 1;
    const rawValue = imp.minValue + roll * (imp.maxValue - imp.minValue);
    const resolved = resolvePropertyValue(imp.property, rawValue, imp.tags);
    if (!resolved) continue;

    modifiers.push({
      id: `blessing-${entry.subType}-${i}`,
      sourceType: "blessing",
      sourceId: `blessing-${entry.subType}`,
      targetStat: resolved.statId,
      operation: "add",
      value: resolved.value,
    });
  }
  return modifiers;
}

// Some maxroll profile affix IDs refer to table indexes rather than canonical affixId.
const AFFIX_ID_ALIASES: Record<number, number> = {
  785: 698,
  805: 720,
  820: 735,
  1089: 1070,
  1095: 1078,
  1102: 1085,
  1103: 1086,
};

function resolveCanonicalAffixId(affixId: number): number {
  return AFFIX_ID_ALIASES[affixId] ?? affixId;
}

/** Determine rarity from a maxroll item. */
function determineRarity(item: MaxrollItem): ItemRarity {
  if (item.uniqueID != null) {
    const uniqueDef = getUniqueItem(item.uniqueID);
    return uniqueDef?.isSetItem ? "set" : "unique";
  }
  const maxTier = Math.max(0, ...item.affixes.map((a) => a.tier));
  if (maxTier >= 6) return "exalted";
  if (item.affixes.length >= 3) return "rare";
  if (item.affixes.length >= 1) return "magic";
  return "normal";
}

/**
 * Convert a maxroll affix roll value (0-1) to an absolute stat value
 * using the tier's min/max range.
 */
function resolveAffixValue(affixId: number, tier: number, roll: number): number {
  const canonicalAffixId = resolveCanonicalAffixId(affixId);
  const tiers = affixTierLookup.get(canonicalAffixId);
  if (!tiers) return roll;
  const tierData = tiers.find((t) => t.tier === tier);
  if (!tierData) return roll;
  const value = tierData.minValue + roll * (tierData.maxValue - tierData.minValue);
  // Maxroll tiers store many percentage affixes as fractions (e.g. 0.12 = 12%).
  return Math.abs(value) <= 1 && Math.abs(tierData.maxValue) <= 1 ? value * 100 : value;
}

interface ConvertedEquipment {
  slot: ItemSlot;
  baseId: string;
  rarity: ItemRarity;
  affixes: { affixId: string; tier: number; value: number }[];
  implicitRolls?: number[];
  uniqueId?: number;
  uniqueName?: string;
  uniqueEffects?: Modifier[];
}

/** Convert a maxroll item + slot to our equipment format. */
function convertMaxrollItem(item: MaxrollItem, maxrollSlot: string): ConvertedEquipment | null {
  const ourSlot = MAXROLL_SLOT_TO_OURS[maxrollSlot];
  if (!ourSlot) return null; // Skip unmapped slots (e.g. altar)

  // Resolve the item base using the slot from our equipment data
  const lookupSlot = itemBaseLookup.get(`${item.itemType}-${item.subType}`);
  if (!lookupSlot) return null; // Item base not in our data

  const baseId = `${lookupSlot}-${item.itemType}-${item.subType}`;
  const rarity = determineRarity(item);

  const affixes = item.affixes.map((a) => ({
    affixId: `affix-${resolveCanonicalAffixId(a.id)}`,
    tier: a.tier,
    value: resolveAffixValue(a.id, a.tier, a.roll),
  }));

  // Include sealed affix if present
  if (item.sealedAffix) {
    affixes.push({
      affixId: `affix-${resolveCanonicalAffixId(item.sealedAffix.id)}`,
      tier: item.sealedAffix.tier,
      value: resolveAffixValue(item.sealedAffix.id, item.sealedAffix.tier, item.sealedAffix.roll),
    });
  }

  // Resolve unique item info
  let uniqueId: number | undefined;
  let uniqueName: string | undefined;
  let uniqueEffects: Modifier[] | undefined;
  if (item.uniqueID != null) {
    uniqueId = item.uniqueID;
    const uniqueDef = getUniqueItem(item.uniqueID);
    if (uniqueDef) {
      uniqueName = uniqueDef.displayName ?? uniqueDef.name;
    }
    uniqueEffects = convertUniqueMods(item.uniqueID, item.uniqueRolls);
    if (uniqueEffects.length === 0) uniqueEffects = undefined;
  }

  return {
    slot: ourSlot,
    baseId,
    rarity,
    affixes,
    implicitRolls: item.implicits,
    uniqueId,
    uniqueName,
    uniqueEffects,
  };
}

function convertItemAffixesToModifiers(
  item: MaxrollItem,
  sourceType: Modifier["sourceType"],
  sourceId: string,
): Modifier[] {
  const modifiers: Modifier[] = [];
  const rolls: MaxrollAffix[] = [...item.affixes];
  if (item.sealedAffix) rolls.push(item.sealedAffix);
  if (item.corruptedAffix) rolls.push(item.corruptedAffix);

  for (const roll of rolls) {
    const affixDef = affixes.find((a) => a.id === `affix-${resolveCanonicalAffixId(roll.id)}`);
    if (!affixDef) continue;

    const value = resolveAffixValue(roll.id, roll.tier, roll.roll);
    modifiers.push({
      id: `${sourceId}-${affixDef.id}-t${roll.tier}`,
      sourceType,
      sourceId,
      targetStat: affixDef.targetStat as Modifier["targetStat"],
      operation: affixDef.operation as Modifier["operation"],
      value,
      tags: affixDef.tags,
    });

    if (affixDef.additionalProperties && affixDef.additionalProperties.length > 0) {
      const tierDef = affixDef.tiers.find((t) => t.tier === roll.tier);
      if (!tierDef) continue;

      const primarySpan = tierDef.maxValue - tierDef.minValue;
      const rawRatio = primarySpan === 0 ? 0 : (value - tierDef.minValue) / primarySpan;
      const rollRatio = Math.min(1, Math.max(0, rawRatio));

      for (const extra of affixDef.additionalProperties) {
        const extraRange = tierDef.extraRolls?.[extra.extraRollIndex];
        if (!extraRange) continue;
        const extraValue =
          extraRange.minValue + rollRatio * (extraRange.maxValue - extraRange.minValue);

        modifiers.push({
          id: `${sourceId}-${affixDef.id}-t${roll.tier}-x${extra.extraRollIndex + 1}`,
          sourceType,
          sourceId,
          targetStat: extra.targetStat as Modifier["targetStat"],
          operation: extra.operation as Modifier["operation"],
          value: extraValue,
          tags: affixDef.tags,
        });
      }
    }
  }

  return modifiers;
}

// ── Class/mastery mapping ──────────────────────────────────────────────────

interface ImportedClassEntry {
  class: {
    id: string;
    name: string;
    masteries: { id: string; name: string; classId: string }[];
  };
  passives: Record<string, { nodeId: string }[]>;
  skills: Record<
    string,
    { abilityKey: string; treeKey: string | null; name: string; nodes: { nodeId: string }[] }[]
  >;
}

const classEntries = (importedData as unknown as { classes: ImportedClassEntry[] }).classes;

/** Map numeric class index (0-4) to our string classId. */
function classIdFromIndex(idx: number): string {
  const entry = classEntries[idx];
  if (!entry) throw new Error(`Unknown class index: ${idx}`);
  return entry.class.id;
}

/**
 * Map numeric mastery index to our string masteryId.
 * Maxroll uses 1-based mastery indices (0 = no mastery, 1/2/3 = first/second/third).
 */
function masteryIdFromIndex(classIdx: number, masteryIdx: number): string | undefined {
  if (masteryIdx === 0) return undefined;
  const entry = classEntries[classIdx];
  if (!entry) throw new Error(`Unknown class index: ${classIdx}`);
  const mastery = entry.class.masteries[masteryIdx - 1];
  if (!mastery) throw new Error(`Unknown mastery index ${masteryIdx} for class ${classIdx}`);
  return mastery.id;
}

// ── Skill ID conversion ───────────────────────────────────────────────────

/** Same logic as maxroll-adapter.ts skillIdFromAbilityKey */
function skillIdFromAbilityKey(key: string): string {
  const raw = key
    .replace(/^(?:Runemaster|Warlock|Falconer)\s+\d+[a-z]?\d?\s*/i, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  if (raw === "icebarrage") return "glacier";
  return raw;
}

// ── Build lookup tables (computed once) ────────────────────────────────────

interface SkillLookup {
  abilityKey: string;
  treeKey: string;
  skillId: string;
  nodeIds: string[];
}

interface ClassLookup {
  classId: string;
  /** Map passive nodeId (string) → our treeId (e.g. "mage-base", "runemaster") */
  passiveNodeToTree: Map<string, string>;
  /** Map treeKey → skill lookup info */
  skillsByTreeKey: Map<string, SkillLookup>;
  /** Map abilityKey → skill lookup info */
  skillsByAbilityKey: Map<string, SkillLookup>;
}

const classLookups = new Map<number, ClassLookup>();

function getClassLookup(classIdx: number): ClassLookup {
  let lookup = classLookups.get(classIdx);
  if (lookup) return lookup;

  const entry = classEntries[classIdx];
  if (!entry) throw new Error(`Unknown class index: ${classIdx}`);

  const passiveNodeToTree = new Map<string, string>();
  for (const [treeKey, nodes] of Object.entries(entry.passives)) {
    const isBase = treeKey === entry.class.id;
    const treeId = isBase ? `${entry.class.id}-base` : treeKey;
    for (const n of nodes as { nodeId: string }[]) {
      passiveNodeToTree.set(n.nodeId, treeId);
    }
  }

  const skillsByTreeKey = new Map<string, SkillLookup>();
  const skillsByAbilityKey = new Map<string, SkillLookup>();
  for (const skills of Object.values(entry.skills)) {
    for (const sk of skills as {
      abilityKey: string;
      treeKey: string | null;
      name: string;
      nodes: { nodeId: string }[];
    }[]) {
      const skillId = skillIdFromAbilityKey(sk.abilityKey);
      const treeKey = sk.treeKey ?? skillId;
      const info: SkillLookup = {
        abilityKey: sk.abilityKey,
        treeKey,
        skillId,
        nodeIds: sk.nodes.map((n) => n.nodeId),
      };
      skillsByTreeKey.set(treeKey, info);
      skillsByAbilityKey.set(sk.abilityKey, info);
    }
  }

  lookup = { classId: entry.class.id, passiveNodeToTree, skillsByTreeKey, skillsByAbilityKey };
  classLookups.set(classIdx, lookup);
  return lookup;
}

// ── History replay helpers ─────────────────────────────────────────────────

/** Replay a history array into node allocation counts. */
function replayHistory(
  history: number[],
  nodeIdToKey: (nodeId: number) => string | undefined,
): Map<string, number> {
  const allocs = new Map<string, number>();
  for (const nodeId of history) {
    const key = nodeIdToKey(nodeId);
    if (key) {
      allocs.set(key, (allocs.get(key) ?? 0) + 1);
    }
  }
  return allocs;
}

// ── Public conversion types ────────────────────────────────────────────────

export interface ImportedEquipmentItem {
  slot: ItemSlot;
  baseId: string;
  rarity: ItemRarity;
  affixes: { affixId: string; tier: number; value: number }[];
  uniqueId?: number;
  uniqueName?: string;
  uniqueEffects?: Modifier[];
}

export interface ImportedIdolItem {
  idolId: string;
  slotIndex: number;
}

export interface ImportedBuild {
  name: string;
  classId: string;
  masteryId?: string;
  level: number;
  idolAltarId?: string;
  passives: { nodeId: string; points: number }[];
  skills: {
    skillId: string;
    allocatedNodes: { nodeId: string; points: number }[];
  }[];
  equipment: ImportedEquipmentItem[];
  idols: ImportedIdolItem[];
  extraModifiers: Modifier[];
}

export interface ImportResult {
  buildName: string;
  profiles: { name: string; build: ImportedBuild }[];
}

// ── Core conversion ───────────────────────────────────────────────────────

/** Convert a single maxroll profile to our ImportedBuild format. */
export function convertMaxrollProfile(
  profile: MaxrollProfile,
  allItems: Record<string, MaxrollItem>,
): ImportedBuild {
  const classIdx = profile.class;
  const classId = classIdFromIndex(classIdx);
  const masteryId = masteryIdFromIndex(classIdx, profile.mastery);
  const lookup = getClassLookup(classIdx);
  const altarItemIdx = profile.items?.altar;
  const altarItem = altarItemIdx != null ? allItems[String(altarItemIdx)] : undefined;
  const idolAltarId = altarItem?.itemType === 41 ? `altar-41-${altarItem.subType}` : undefined;

  // ── Passives ──
  const passiveAllocs = replayHistory(profile.passives.history, (nodeId) => {
    const treeId = lookup.passiveNodeToTree.get(String(nodeId));
    return treeId ? `${treeId}:${nodeId}` : undefined;
  });
  const passives = [...passiveAllocs.entries()].map(([nodeId, points]) => ({ nodeId, points }));

  // ── Skills ──
  const specialized = profile.specializedSkills ?? [];
  const skills = specialized.map((abilityKey) => {
    const info = lookup.skillsByAbilityKey.get(abilityKey);
    if (!info) {
      return { skillId: skillIdFromAbilityKey(abilityKey), allocatedNodes: [] };
    }

    const treeHistory = profile.skillTrees[info.treeKey];
    const allocatedNodes: { nodeId: string; points: number }[] = [];

    if (treeHistory) {
      const allocs = replayHistory(treeHistory.history, (nodeId) => `${info.treeKey}:${nodeId}`);
      for (const [nodeId, points] of allocs) {
        allocatedNodes.push({ nodeId, points });
      }
    }

    return { skillId: info.skillId, allocatedNodes };
  });

  // ── Equipment ──
  const equipment: ImportedEquipmentItem[] = [];
  const idols: ImportedIdolItem[] = [];
  const extraModifiers: Modifier[] = [];
  const consumedExtraItemIndexes = new Set<string>();
  for (const [slotName, itemIdx] of Object.entries(profile.items)) {
    const itemKey = String(itemIdx);
    const item = allItems[itemKey];
    if (!item) continue;
    const converted = convertMaxrollItem(item, slotName);
    if (converted) {
      equipment.push(converted);
    } else {
      extraModifiers.push(
        ...convertItemAffixesToModifiers(item, "idol", `extra:${slotName}:${itemKey}`),
      );
      consumedExtraItemIndexes.add(itemKey);
    }
  }

  for (const [slotIndex, idolIdx] of (profile.idols ?? []).entries()) {
    if (idolIdx == null) continue;
    const idolKey = String(idolIdx);
    if (consumedExtraItemIndexes.has(idolKey)) continue;
    const idolItem = allItems[idolKey];
    if (!idolItem) continue;

    // Idol item bases are not present in equipment-import.json,
    // so keep a stable synthetic idol id from maxroll type/subtype.
    if (idolItem.itemType >= 25 && idolItem.itemType <= 33) {
      idols.push({
        idolId: `idol-${idolItem.itemType}-${idolItem.subType}`,
        slotIndex,
      });
    }

    extraModifiers.push(...convertItemAffixesToModifiers(idolItem, "idol", `idol:${idolKey}`));
  }

  // ── Blessings ──
  for (const entry of profile.blessings ?? []) {
    if (!entry) continue;
    extraModifiers.push(...convertBlessingToModifiers(entry));
  }

  return {
    name: profile.name,
    classId,
    masteryId,
    level: profile.level,
    idolAltarId,
    passives,
    skills,
    equipment,
    idols,
    extraModifiers,
  };
}

/** Parse a maxroll share URL to extract the build ID and profile index. */
export function parseMaxrollUrl(input: string): { id: string; profileIndex: number } | null {
  // Accept full URL or just the ID
  const urlMatch = input.match(/maxroll\.gg\/last-epoch\/planner\/([a-zA-Z0-9]+)/);
  const id = urlMatch ? urlMatch[1] : input.trim();
  if (!id || !/^[a-zA-Z0-9]+$/.test(id)) return null;

  // Fragment #N selects profile (0-based internally, but UI shows 1-based tabs)
  const fragMatch = input.match(/#(\d+)/);
  const frag = fragMatch?.[1] ?? "";
  const profileIndex = frag ? Math.max(0, parseInt(frag, 10) - 1) : 0;

  return { id, profileIndex };
}

/** Convert the full API response into an ImportResult with all profiles. */
export function convertMaxrollBuild(apiResponse: MaxrollApiResponse): ImportResult {
  const buildData: MaxrollBuildData = JSON.parse(apiResponse.data);

  return {
    buildName: apiResponse.name,
    profiles: buildData.profiles.map((profile) => ({
      name: profile.name,
      build: convertMaxrollProfile(profile, buildData.items),
    })),
  };
}

/** The maxroll planner API base URL. */
export const MAXROLL_API_URL = "https://planners.maxroll.gg/profiles/last-epoch";
