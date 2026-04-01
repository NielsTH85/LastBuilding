import type {
  Build,
  EquippedItem,
  ItemAffixRoll,
} from "./types.js";
import type { ItemSlot, ItemRarity } from "@eob/game-data";

const BUILD_VERSION = "0.1.0";

/** Create a new empty build for a given class/mastery. */
export function createEmptyBuild(classId: string, masteryId?: string): Build {
  return {
    version: BUILD_VERSION,
    character: {
      classId,
      masteryId,
      level: 1,
    },
    passives: [],
    skills: [],
    equipment: {},
    idols: [],
    blessings: [],
    toggles: [],
    config: {
      enemyLevel: 1,
    },
  };
}

/** Deep-clone a build for immutable snapshot comparison. */
export function cloneBuild(build: Build): Build {
  return JSON.parse(JSON.stringify(build)) as Build;
}

/** Set or update passive allocation points. */
export function allocatePassive(build: Build, nodeId: string, points: number): Build {
  const next = cloneBuild(build);
  const existing = next.passives.find((p) => p.nodeId === nodeId);
  if (existing) {
    existing.points = points;
  } else {
    next.passives.push({ nodeId, points });
  }
  // Remove if points is 0
  next.passives = next.passives.filter((p) => p.points > 0);
  return next;
}

/** Deallocate a passive node. */
export function deallocatePassive(build: Build, nodeId: string): Build {
  return allocatePassive(build, nodeId, 0);
}

/** Add a skill to the build (max 5). */
export function addSkill(build: Build, skillId: string): Build {
  if (build.skills.length >= 5) return build;
  if (build.skills.some((s) => s.skillId === skillId)) return build;
  const next = cloneBuild(build);
  next.skills.push({ skillId, allocatedNodes: [] });
  return next;
}

/** Remove a skill from the build. */
export function removeSkill(build: Build, skillId: string): Build {
  const next = cloneBuild(build);
  next.skills = next.skills.filter((s) => s.skillId !== skillId);
  return next;
}

/** Allocate points to a skill node. */
export function allocateSkillNode(
  build: Build,
  skillId: string,
  nodeId: string,
  points: number,
): Build {
  const next = cloneBuild(build);
  const skill = next.skills.find((s) => s.skillId === skillId);
  if (!skill) return next;

  const existing = skill.allocatedNodes.find((n) => n.nodeId === nodeId);
  if (existing) {
    existing.points = points;
  } else {
    skill.allocatedNodes.push({ nodeId, points });
  }
  skill.allocatedNodes = skill.allocatedNodes.filter((n) => n.points > 0);
  return next;
}

/** Equip an item in a slot. */
export function equipItem(build: Build, slot: ItemSlot, item: EquippedItem): Build {
  const next = cloneBuild(build);
  next.equipment[slot] = item;
  return next;
}

/** Unequip an item from a slot. */
export function unequipItem(build: Build, slot: ItemSlot): Build {
  const next = cloneBuild(build);
  delete next.equipment[slot];
  return next;
}

/** Create a simple equipped item. */
export function createEquippedItem(
  baseId: string,
  rarity: ItemRarity = "normal",
  affixes: ItemAffixRoll[] = [],
): EquippedItem {
  return { baseId, rarity, affixes };
}
