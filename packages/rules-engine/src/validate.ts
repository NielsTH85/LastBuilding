import type { Build } from "@eob/build-model";
import type { GameData, PassiveTreeDef } from "@eob/game-data";

export interface ValidationError {
  type: "passive" | "skill" | "equipment";
  nodeId?: string;
  message: string;
}

/**
 * Validate passive allocations against tree rules.
 */
export function validatePassives(build: Build, gameData: GameData): ValidationError[] {
  const errors: ValidationError[] = [];
  const allocatedSet = new Set(build.passives.map((p) => p.nodeId));

  for (const alloc of build.passives) {
    const node = findNode(alloc.nodeId, gameData.passiveTrees);
    if (!node) {
      errors.push({
        type: "passive",
        nodeId: alloc.nodeId,
        message: `Unknown passive node: ${alloc.nodeId}`,
      });
      continue;
    }

    // Check max points
    if (alloc.points > node.maxPoints) {
      errors.push({
        type: "passive",
        nodeId: alloc.nodeId,
        message: `${node.name}: ${alloc.points} points exceeds max ${node.maxPoints}`,
      });
    }

    // Check prerequisites
    for (const prereq of node.prerequisites) {
      if (!allocatedSet.has(prereq)) {
        errors.push({
          type: "passive",
          nodeId: alloc.nodeId,
          message: `${node.name}: prerequisite ${prereq} not allocated`,
        });
      }
    }

    // Check mastery requirement
    const tree = findTree(alloc.nodeId, gameData.passiveTrees);
    if (tree?.masteryId && build.character.masteryId !== tree.masteryId) {
      errors.push({
        type: "passive",
        nodeId: alloc.nodeId,
        message: `${node.name}: requires mastery ${tree.masteryId}`,
      });
    }
  }

  return errors;
}

/**
 * Validate skill allocations.
 */
export function validateSkills(build: Build, _gameData: GameData): ValidationError[] {
  const errors: ValidationError[] = [];

  if (build.skills.length > 5) {
    errors.push({
      type: "skill",
      message: `Too many specialized skills: ${build.skills.length} (max 5)`,
    });
  }

  // Check for duplicate skills
  const skillIds = new Set<string>();
  for (const skill of build.skills) {
    if (skillIds.has(skill.skillId)) {
      errors.push({
        type: "skill",
        message: `Duplicate skill: ${skill.skillId}`,
      });
    }
    skillIds.add(skill.skillId);
  }

  return errors;
}

/**
 * Validate the entire build.
 */
export function validateBuild(build: Build, gameData: GameData): ValidationError[] {
  return [...validatePassives(build, gameData), ...validateSkills(build, gameData)];
}

function findNode(nodeId: string, trees: PassiveTreeDef[]) {
  for (const tree of trees) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

function findTree(nodeId: string, trees: PassiveTreeDef[]) {
  for (const tree of trees) {
    if (tree.nodes.some((n) => n.id === nodeId)) return tree;
  }
  return undefined;
}
