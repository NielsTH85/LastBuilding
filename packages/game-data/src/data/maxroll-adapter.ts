/**
 * Adapter that converts maxroll-import.json into our typed game-data structures.
 * Keeps raw stat info for tooltip display while mapping known stats to Modifiers.
 */

import type { PassiveTreeDef, PassiveNodeDef } from "../types/class.js";
import type { SkillDef, SkillNodeDef, SkillBaselineDef } from "../types/skill.js";
import type { ClassDef } from "../types/class.js";
import type { Modifier } from "../modifiers.js";
import { mapStat, parseStatValue } from "./stat-mapping.js";
import { getSkillIcon, getNodeIcon, DEFAULT_NODE_ICON } from "./icon-mapping.js";
import importedData from "./maxroll-import.json" with { type: "json" };
import skillBaselinesData from "./skill-baselines.json" with { type: "json" };

// ── Types for the imported JSON ────────────────────────────────────────────

interface ImportedStat {
  statName: string;
  value: string;
  property: number;
  tags: number;
  noScaling: boolean;
  downside: boolean;
}

interface ImportedRequirement {
  nodeId: string;
  points: number;
}

interface ImportedNode {
  nodeId: string;
  name: string;
  description: string;
  altText: string;
  maxPoints: number;
  masteryRequirement?: number;
  position: { x: number; y: number };
  requirements: ImportedRequirement[];
  stats: ImportedStat[];
  icon: number;
}

interface ImportedSkill {
  abilityKey: string;
  treeKey: string | null;
  name: string;
  description: string;
  altText: string;
  tags: number;
  manaCost: number;
  channelled: boolean;
  channelCost: number;
  nodeCount: number;
  nodes: ImportedNode[];
}

interface ImportedClassEntry {
  class: {
    id: string;
    name: string;
    baseStats: Record<string, number>;
    masteries: { id: string; name: string; classId: string }[];
  };
  passives: Record<string, ImportedNode[]>;
  skills: Record<string, ImportedSkill[]>;
}

const skillBaselines = skillBaselinesData as Record<string, SkillBaselineDef>;

// ── Node stat description storage ──────────────────────────────────────────

/** Raw stat descriptions per node, for tooltip display */
const nodeStatDescriptions = new Map<string, ImportedStat[]>();

export function getNodeStatDescriptions(nodeId: string): ImportedStat[] {
  return nodeStatDescriptions.get(nodeId) ?? [];
}

// ── Conversion helpers ─────────────────────────────────────────────────────

function convertNodeStats(
  node: ImportedNode,
  sourceType: "passive" | "skillNode",
  treeId: string,
): Modifier[] {
  const modifiers: Modifier[] = [];
  const nodeKey = `${treeId}:${node.nodeId}`;

  // Store raw stats for tooltip display
  nodeStatDescriptions.set(nodeKey, node.stats);

  for (const stat of node.stats) {
    const mapped = mapStat(stat.statName, stat.value);
    const fallbackTarget = stat.statName
      .toLowerCase()
      .replace(/[%()]/g, "")
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");
    const fallbackOperation: Modifier["operation"] = /\bmore\b/i.test(stat.statName)
      ? "more"
      : /\bincreased\b|\breduced\b|\bless\b/i.test(stat.statName)
        ? "increased"
        : "add";

    let numericValue = parseStatValue(stat.value);
    const hasExplicitNumber = /-?\d+(?:\.\d+)?/.test(stat.value);

    // Keep non-numeric skill effects in the pipeline as binary flags.
    if (!hasExplicitNumber) {
      numericValue = stat.downside ? -1 : 1;
    }

    const targetStat = mapped?.targetStat ?? fallbackTarget;
    const operation = mapped?.operation ?? fallbackOperation;
    const mul = mapped?.valueMul ?? 1;

    modifiers.push({
      id: `${nodeKey}-${stat.statName.toLowerCase().replace(/\s+/g, "-")}`,
      sourceType,
      sourceId: nodeKey,
      targetStat: targetStat as Modifier["targetStat"],
      operation,
      value: numericValue * mul,
    });
  }

  return modifiers;
}

function convertPassiveNode(
  node: ImportedNode,
  treeId: string,
): PassiveNodeDef {
  return {
    id: `${treeId}:${node.nodeId}`,
    treeId,
    name: node.name,
    description:
      node.description ||
      node.stats.map((s) => `${s.statName} ${s.value}`).join(", "),
    maxPoints: node.maxPoints,
    position: node.position,
    prerequisites: node.requirements.map((r) => `${treeId}:${r.nodeId}`),
    modifiersPerPoint: convertNodeStats(node, "passive", treeId),
    masteryRequirement: node.masteryRequirement ?? 0,
    icon: getNodeIcon(node.name, undefined, node.icon),
  };
}

function convertSkillNode(
  node: ImportedNode,
  treeId: string,
  parentSkillId?: string,
): SkillNodeDef {
  const isRootNode = node.nodeId === "0";
  return {
    id: `${treeId}:${node.nodeId}`,
    treeId,
    name: node.name,
    description:
      node.description ||
      node.stats.map((s) => `${s.statName} ${s.value}`).join(", "),
    maxPoints: node.maxPoints,
    position: node.position,
    prerequisites: node.requirements.map((r) => `${treeId}:${r.nodeId}`),
    modifiersPerPoint: convertNodeStats(node, "skillNode", treeId),
    icon: isRootNode && parentSkillId
      ? getNodeIcon(node.name, parentSkillId)
      : getNodeIcon(node.name, undefined, node.icon),
  };
}

function skillIdFromAbilityKey(key: string): string {
  const raw = key
    .replace(/^(?:Runemaster|Warlock|Falconer)\s+\d+[a-z]?\d?\s*/i, "")
    .replace(/\s+/g, "-")
    .toLowerCase();

  // Keep stable IDs for legacy compatibility with saved builds/UI.
  if (raw === "icebarrage") return "glacier";
  return raw;
}

function canonicalSkillName(abilityKey: string, currentName: string): string {
  const normalized = abilityKey.toLowerCase();
  if (normalized === "icebarrage") return "Glacier";
  return currentName;
}

function convertSkillList(
  skills: ImportedSkill[],
  classId: string,
  masteryId?: string,
): SkillDef[] {
  return skills.map((sk) => {
    const skillId = skillIdFromAbilityKey(sk.abilityKey);
    const treeId = sk.treeKey ?? skillId;
    const rootNode = sk.nodes.find((n) => n.nodeId === "0") ?? sk.nodes[0];
    const fallbackIcon = rootNode ? getNodeIcon(rootNode.name, undefined, rootNode.icon) : undefined;

    return {
      id: skillId,
      name: canonicalSkillName(sk.abilityKey, sk.name),
      classId,
      masteryId,
      description: sk.description,
      baseMana: sk.manaCost,
      tags: ["spell"],
      icon: getSkillIcon(skillId) ?? fallbackIcon ?? DEFAULT_NODE_ICON,
      baseline: skillBaselines[skillId],
      tree: {
        id: treeId,
        skillId,
        nodes: sk.nodes.map((n) => convertSkillNode(n, treeId, skillId)),
      },
    };
  });
}

// ── Cached data ────────────────────────────────────────────────────────────

const classEntries = (importedData as unknown as { classes: ImportedClassEntry[] }).classes;

// ── Public API ─────────────────────────────────────────────────────────────

/** Get all available class definitions. */
export function getImportedClasses(): ClassDef[] {
  return classEntries.map((entry) => ({
    id: entry.class.id,
    name: entry.class.name,
    baseStats: {
      strength: entry.class.baseStats.strength ?? 0,
      dexterity: entry.class.baseStats.dexterity ?? 0,
      intelligence: entry.class.baseStats.intelligence ?? 0,
      attunement: entry.class.baseStats.attunement ?? 0,
      vitality: entry.class.baseStats.vitality ?? 0,
      health: entry.class.baseStats.health ?? 0,
      mana: entry.class.baseStats.mana ?? 0,
      health_regen: entry.class.baseStats.healthRegen ?? 0,
      mana_regen: entry.class.baseStats.manaRegen ?? 0,
      crit_chance: 5,
      crit_multiplier: 200,
    },
    masteries: entry.class.masteries.map((m) => ({
      id: m.id,
      name: m.name,
      classId: m.classId,
    })),
  }));
}

/** Get a single class definition by ID. */
export function getImportedClass(classId: string): ClassDef | undefined {
  return getImportedClasses().find((c) => c.id === classId);
}

/** Backward compat: get the mage class. */
export function getImportedMageClass(): ClassDef {
  return getImportedClass("mage")!;
}

/** Get passive trees for a specific class (base + all masteries). */
export function getImportedPassiveTrees(classId?: string): PassiveTreeDef[] {
  const trees: PassiveTreeDef[] = [];

  for (const entry of classEntries) {
    if (classId && entry.class.id !== classId) continue;

    for (const [key, nodes] of Object.entries(entry.passives)) {
      // key is the mastery ID (or base class ID for base nodes)
      const isBase = key === entry.class.id;

      const treeId = isBase ? `${entry.class.id}-base` : key;
      trees.push({
        id: treeId,
        classId: entry.class.id,
        masteryId: isBase ? undefined : key,
        name: isBase
          ? `${entry.class.name} Base Passives`
          : `${(entry.class.masteries.find((m) => m.id === key)?.name) ?? key} Passives`,
        nodes: (nodes as ImportedNode[]).map((n) =>
          convertPassiveNode(n, treeId),
        ),
      });
    }
  }

  return trees;
}

/** Get skills for a specific class (base + mastery). */
export function getImportedSkills(classId?: string, masteryId?: string): SkillDef[] {
  const allSkills: SkillDef[] = [];

  for (const entry of classEntries) {
    if (classId && entry.class.id !== classId) continue;

    for (const [key, skills] of Object.entries(entry.skills)) {
      const isBase = key === "base";
      if (masteryId && !isBase && key !== masteryId) continue;

      allSkills.push(
        ...convertSkillList(
          skills as ImportedSkill[],
          entry.class.id,
          isBase ? undefined : key,
        ),
      );
    }
  }

  return allSkills;
}
