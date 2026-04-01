import type { Build } from "@eob/build-model";
import type { GameData, Modifier, PassiveTreeDef } from "@eob/game-data";

/**
 * Collect all active modifiers from a build.
 * Walks passives, skill nodes, item implicits, item affixes, and base stats.
 */
export function collectModifiers(build: Build, gameData: GameData): Modifier[] {
  const modifiers: Modifier[] = [];

  // 1. Base class stats
  const classDef = gameData.classes.find((c) => c.id === build.character.classId);
  if (classDef) {
    for (const [stat, value] of Object.entries(classDef.baseStats)) {
      modifiers.push({
        id: `base-${stat}`,
        sourceType: "base",
        sourceId: classDef.id,
        targetStat: stat as Modifier["targetStat"],
        operation: "add",
        value,
      });
    }

    // Mastery bonus stats
    if (build.character.masteryId) {
      const mastery = classDef.masteries.find((m) => m.id === build.character.masteryId);
      if (mastery?.bonusStats) {
        for (const [stat, value] of Object.entries(mastery.bonusStats)) {
          modifiers.push({
            id: `mastery-${stat}`,
            sourceType: "base",
            sourceId: mastery.id,
            targetStat: stat as Modifier["targetStat"],
            operation: "add",
            value,
          });
        }
      }
    }
  }

  // 2. Passive nodes
  for (const alloc of build.passives) {
    const node = findPassiveNode(alloc.nodeId, gameData.passiveTrees);
    if (node) {
      for (const mod of node.modifiersPerPoint) {
        modifiers.push({
          ...mod,
          value: mod.value * alloc.points,
          id: `${mod.id}-x${alloc.points}`,
        });
      }
    }
  }

  // 3. Skill nodes
  for (const skillAlloc of build.skills) {
    const skillDef = gameData.skills.find((s) => s.id === skillAlloc.skillId);
    if (!skillDef) continue;
    for (const nodeAlloc of skillAlloc.allocatedNodes) {
      const node = skillDef.tree.nodes.find((n) => n.id === nodeAlloc.nodeId);
      if (node) {
        for (const mod of node.modifiersPerPoint) {
          modifiers.push({
            ...mod,
            value: mod.value * nodeAlloc.points,
            id: `${mod.id}-x${nodeAlloc.points}`,
          });
        }
      }
    }
  }

  // 4. Equipment
  for (const item of Object.values(build.equipment)) {
    if (!item) continue;

    // Item base implicits
    const baseDef = gameData.itemBases.find((b) => b.id === item.baseId);
    if (baseDef) {
      for (const impl of baseDef.implicits) {
        modifiers.push(impl);
      }
    }

    // Affixes
    for (const roll of item.affixes) {
      const affixDef = gameData.affixes.find((a) => a.id === roll.affixId);
      if (affixDef) {
        modifiers.push({
          id: `${affixDef.id}-t${roll.tier}`,
          sourceType: "item",
          sourceId: item.baseId,
          targetStat: affixDef.targetStat as Modifier["targetStat"],
          operation: affixDef.operation as Modifier["operation"],
          value: roll.value,
          tags: affixDef.tags,
        });
      }
    }

    // Unique effects
    if (item.uniqueEffects) {
      for (const ue of item.uniqueEffects) {
        modifiers.push(ue);
      }
    }
  }

  return modifiers;
}

function findPassiveNode(nodeId: string, trees: PassiveTreeDef[]) {
  for (const tree of trees) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}
