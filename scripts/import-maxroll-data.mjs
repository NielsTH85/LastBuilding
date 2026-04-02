/**
 * Import script: reads maxroll-game-data.json and writes
 * structured data for packages/game-data.
 *
 * Usage: node scripts/import-maxroll-data.mjs
 *
 * Imports ALL classes with ALL masteries and skills.
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = resolve(__dirname, "..");

const raw = JSON.parse(readFileSync(resolve(root, "maxroll-game-data.json"), "utf-8"));

// ── Constants ──────────────────────────────────────────────────────────────

/** Map class index → passive tree key. */
const CLASS_TREE_KEYS = {
  0: "pr-1",  // Primalist
  1: "mg-1",  // Mage
  2: "kn-1",  // Sentinel
  3: "ac-1",  // Acolyte
  4: "rg-1",  // Rogue
};

/** Friendly class IDs. */
const CLASS_IDS = {
  0: "primalist",
  1: "mage",
  2: "sentinel",
  3: "acolyte",
  4: "rogue",
};

/** Friendly mastery IDs per class. mastery[0] is always the base class. */
const MASTERY_IDS = {
  0: ["primalist", "beastmaster", "shaman", "druid"],
  1: ["mage", "sorcerer", "spellblade", "runemaster"],
  2: ["sentinel", "voidknight", "forgeguard", "paladin"],
  3: ["acolyte", "necromancer", "lich", "warlock"],
  4: ["rogue", "bladedancer", "marksman", "falconer"],
};

// Build skill tree key lookup
const SKILL_TREE_KEYS = {};
for (const [key, tree] of Object.entries(raw.skillTrees)) {
  if (tree.ability) {
    SKILL_TREE_KEYS[tree.ability] = key;
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────

function extractRequirements(node) {
  const requirements = [];
  if (node.requirements) {
    const reqs = Array.isArray(node.requirements)
      ? node.requirements
      : [node.requirements];
    for (const r of reqs) {
      if (r && r.node !== undefined) {
        requirements.push({
          nodeId: String(r.node),
          points: r.requirement || 1,
        });
      }
    }
  }
  return requirements;
}

function extractStats(node) {
  return (node.stats || []).map((s) => ({
    statName: s.statName,
    value: s.value,
    property: s.property,
    tags: s.tags,
    noScaling: s.noScaling,
    downside: s.downside,
  }));
}

function extractPosition(node) {
  return node.transform
    ? { x: Math.round(node.transform.x ?? 0), y: Math.round(node.transform.y ?? 0) }
    : { x: 0, y: 0 };
}

function extractPassiveNodes(treeKey, masteryFilter) {
  const tree = raw.skillTrees[treeKey];
  if (!tree) return [];

  const nodes = [];
  for (const [nodeId, node] of Object.entries(tree.nodes)) {
    if (node.mastery !== masteryFilter) continue;

    nodes.push({
      nodeId: String(nodeId),
      name: node.nodeName,
      description: node.description || "",
      altText: node.altText || "",
      maxPoints: node.maxPoints,
      masteryRequirement: node.masteryRequirement || 0,
      position: extractPosition(node),
      requirements: extractRequirements(node),
      stats: extractStats(node),
      icon: node.icon,
    });
  }
  return nodes;
}

function extractSkill(abilityKey) {
  const ability = raw.abilities[abilityKey];
  if (!ability) {
    console.warn(`  WARNING: ability "${abilityKey}" not found in game data`);
    return null;
  }

  const treeKey = SKILL_TREE_KEYS[abilityKey];
  const skillTree = treeKey ? raw.skillTrees[treeKey] : null;

  const treeNodes = [];
  if (skillTree && skillTree.nodes) {
    for (const [nodeId, node] of Object.entries(skillTree.nodes)) {
      treeNodes.push({
        nodeId: String(nodeId),
        name: node.nodeName,
        description: node.description || "",
        altText: node.altText || "",
        maxPoints: node.maxPoints,
        position: extractPosition(node),
        requirements: extractRequirements(node),
        stats: extractStats(node),
        icon: node.icon,
      });
    }
  }

  return {
    abilityKey,
    treeKey: treeKey || null,
    name: ability.abilityName || abilityKey,
    description: ability.description || "",
    altText: ability.altText || "",
    tags: ability.tags,
    manaCost: ability.manaCost || 0,
    channelled: ability.channelled || false,
    channelCost: ability.channelCost || 0,
    nodeCount: treeNodes.length,
    nodes: treeNodes,
  };
}

// ── Extract All Classes ────────────────────────────────────────────────────

const classes = [];

for (let ci = 0; ci < raw.classes.length; ci++) {
  const cls = raw.classes[ci];
  const classId = CLASS_IDS[ci];
  const treeKey = CLASS_TREE_KEYS[ci];
  const masteryIds = MASTERY_IDS[ci];

  console.log(`\nProcessing ${cls.className}...`);

  // Class data
  const classData = {
    id: classId,
    name: cls.className,
    baseStats: {
      strength: cls.baseStrength,
      dexterity: cls.baseDexterity,
      intelligence: cls.baseIntelligence,
      attunement: cls.baseAttunement,
      vitality: cls.baseVitality,
      health: cls.baseHealth,
      mana: cls.baseMana,
      healthRegen: cls.healthRegen,
      manaRegen: cls.manaRegen,
      healthPerLevel: cls.healthPerLevel,
      manaPerLevel: cls.manaPerLevel,
      baseStunAvoidance: cls.baseStunAvoidance,
      baseEndurance: cls.baseEndurance,
    },
    masteries: [],
  };

  // Extract masteries (skip index 0 = base class)
  for (let mi = 1; mi < cls.masteries.length; mi++) {
    const m = cls.masteries[mi];
    classData.masteries.push({
      id: masteryIds[mi],
      name: m.name,
      classId,
    });
  }

  // Extract passives per mastery
  const passives = {};
  for (let mi = 0; mi < masteryIds.length; mi++) {
    const nodes = extractPassiveNodes(treeKey, mi);
    passives[masteryIds[mi]] = nodes;
    console.log(`  Passives [${masteryIds[mi]}]: ${nodes.length} nodes`);
  }

  // Extract base class skills
  const baseAbilities = [
    ...(cls.knownAbilities || []).filter((a) => a !== "BasicPlayerAttack"),
    ...(cls.unlockableAbilities || []).map((u) => u.ability),
  ];
  const baseSkills = baseAbilities.map(extractSkill).filter(Boolean);
  console.log(`  Base skills: ${baseSkills.length}`);

  // Extract mastery-specific skills
  const masterySkills = {};
  for (let mi = 1; mi < cls.masteries.length; mi++) {
    const m = cls.masteries[mi];
    const abilities = (m.abilities || []).map((a) => a.ability || a).filter(Boolean);
    // Add the mastery ability itself
    if (m.masteryAbility) abilities.unshift(m.masteryAbility);
    const skills = abilities.map(extractSkill).filter(Boolean);
    // Deduplicate (masteryAbility might already be in abilities list)
    const seen = new Set();
    const deduped = skills.filter((s) => {
      if (seen.has(s.abilityKey)) return false;
      seen.add(s.abilityKey);
      return true;
    });
    masterySkills[masteryIds[mi]] = deduped;
    console.log(`  ${m.name} skills: ${deduped.length}`);
  }

  classes.push({
    class: classData,
    passives,
    skills: {
      base: baseSkills,
      ...masterySkills,
    },
  });
}

// ── Write Output ───────────────────────────────────────────────────────────

const output = {
  classes,
  meta: {
    source: "maxroll.gg game data",
    importedAt: new Date().toISOString(),
    classCount: classes.length,
    totalSkillTrees: classes.reduce(
      (sum, c) =>
        sum +
        c.skills.base.length +
        Object.values(c.skills)
          .filter(Array.isArray)
          .reduce((s, a) => s + a.length, 0),
      0,
    ),
  },
};

const outPath = resolve(root, "packages", "game-data", "src", "data", "maxroll-import.json");
writeFileSync(outPath, JSON.stringify(output, null, 2));

console.log("\n✅ Import complete!");
for (const c of classes) {
  const passiveCount = Object.values(c.passives).reduce((s, a) => s + a.length, 0);
  const skillCount =
    c.skills.base.length +
    Object.entries(c.skills)
      .filter(([k]) => k !== "base")
      .reduce((s, [, a]) => s + a.length, 0);
  console.log(`   ${c.class.name}: ${passiveCount} passives, ${skillCount} skills`);
}
console.log(`   Output: ${outPath}`);
