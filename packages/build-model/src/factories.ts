import type { Build, EquippedItem, ItemAffixRoll } from "./types.js";
import type { ItemSlot, ItemRarity } from "@eob/game-data";

const BUILD_VERSION = "0.1.0";

function clampPosition(position: number, length: number): number {
  return Math.max(0, Math.min(length, Math.trunc(position)));
}

function ensureProgression(build: Build) {
  const passives = build.progression?.passives ?? { history: [], position: 0 };
  const skills = build.progression?.skills ?? {};
  build.progression = {
    passives: {
      history: [...passives.history],
      position: clampPosition(passives.position, passives.history.length),
    },
    skills: Object.fromEntries(
      Object.entries(skills).map(([skillId, p]) => [
        skillId,
        { history: [...p.history], position: clampPosition(p.position, p.history.length) },
      ]),
    ),
  };
  return build.progression;
}

function applyProgressionDelta(prog: { history: string[]; position: number }, nodeId: string, delta: number) {
  if (delta === 0) return;
  if (delta > 0) {
    for (let i = 0; i < delta; i++) {
      prog.history.splice(prog.position, 0, nodeId);
      prog.position += 1;
    }
    return;
  }

  let remaining = -delta;

  // Remove from already-spent part first.
  let idx = prog.position - 1;
  while (remaining > 0 && idx >= 0) {
    if (prog.history[idx] === nodeId) {
      prog.history.splice(idx, 1);
      prog.position -= 1;
      remaining -= 1;
    }
    idx -= 1;
  }

  // If needed, remove from planned future section.
  idx = prog.history.length - 1;
  while (remaining > 0 && idx >= 0) {
    if (prog.history[idx] === nodeId) {
      if (idx < prog.position) prog.position -= 1;
      prog.history.splice(idx, 1);
      remaining -= 1;
    }
    idx -= 1;
  }

  prog.position = clampPosition(prog.position, prog.history.length);
}

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
    progression: {
      passives: { history: [], position: 0 },
      skills: {},
    },
    equipment: {},
    extraModifiers: [],
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
  const progression = ensureProgression(next);
  const existing = next.passives.find((p) => p.nodeId === nodeId);
  const previousPoints = existing?.points ?? 0;
  const nextPoints = Math.max(0, points);
  if (existing) {
    existing.points = nextPoints;
  } else {
    next.passives.push({ nodeId, points: nextPoints });
  }

  applyProgressionDelta(progression.passives, nodeId, nextPoints - previousPoints);
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
  const progression = ensureProgression(next);
  next.skills.push({ skillId, allocatedNodes: [] });
  progression.skills[skillId] = progression.skills[skillId] ?? { history: [], position: 0 };
  return next;
}

/** Remove a skill from the build. */
export function removeSkill(build: Build, skillId: string): Build {
  const next = cloneBuild(build);
  const progression = ensureProgression(next);
  next.skills = next.skills.filter((s) => s.skillId !== skillId);
  delete progression.skills[skillId];
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
  const progression = ensureProgression(next);
  const skill = next.skills.find((s) => s.skillId === skillId);
  if (!skill) return next;

  const skillProgression =
    progression.skills[skillId] ??
    (progression.skills[skillId] = {
      history: [],
      position: 0,
    });

  const existing = skill.allocatedNodes.find((n) => n.nodeId === nodeId);
  const previousPoints = existing?.points ?? 0;
  const nextPoints = Math.max(0, points);
  if (existing) {
    existing.points = nextPoints;
  } else {
    skill.allocatedNodes.push({ nodeId, points: nextPoints });
  }

  applyProgressionDelta(skillProgression, nodeId, nextPoints - previousPoints);
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
