import type { Build } from "@eob/build-model";
import type { GameData, Modifier, PassiveTreeDef } from "@eob/game-data";

/**
 * Collect all active modifiers from a build.
 * Walks passives, skill nodes, item implicits, item affixes, and base stats.
 *
 * When `activeSkillId` is provided, derived active-skill formulas can use it,
 * but skill-node modifiers are still collected from all allocated skills so
 * global bonuses from support/specialized trees are preserved.
 */
export function collectModifiers(
  build: Build,
  gameData: GameData,
  _activeSkillId?: string,
): Modifier[] {
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

        // Multi-property affixes share a single roll; project that roll
        // ratio onto each extra property's per-tier range.
        if (affixDef.additionalProperties && affixDef.additionalProperties.length > 0) {
          const tierDef = affixDef.tiers.find((t) => t.tier === roll.tier);
          if (!tierDef) continue;

          const primarySpan = tierDef.maxValue - tierDef.minValue;
          const normalizedPrimaryValue =
            Math.abs(roll.value) > 1 && Math.abs(tierDef.maxValue) <= 1
              ? roll.value / 100
              : roll.value;
          const rawRatio =
            primarySpan === 0 ? 0 : (normalizedPrimaryValue - tierDef.minValue) / primarySpan;
          const rollRatio = Math.min(1, Math.max(0, rawRatio));

          for (const extra of affixDef.additionalProperties) {
            const extraRange = tierDef.extraRolls?.[extra.extraRollIndex];
            if (!extraRange) continue;
            const extraValue =
              extraRange.minValue + rollRatio * (extraRange.maxValue - extraRange.minValue);

            modifiers.push({
              id: `${affixDef.id}-t${roll.tier}-x${extra.extraRollIndex + 1}`,
              sourceType: "item",
              sourceId: item.baseId,
              targetStat: extra.targetStat as Modifier["targetStat"],
              operation: extra.operation as Modifier["operation"],
              value: extraValue,
              tags: affixDef.tags,
            });
          }
        }
      }
    }

    // Unique effects
    if (item.uniqueEffects) {
      for (const ue of item.uniqueEffects) {
        modifiers.push(ue);
      }
    }
  }

  // 5. Imported extras (e.g. maxroll altar/idol entries)
  for (const [index, idolState] of build.idols.entries()) {
    const idol = gameData.idols.find((i) => i.id === idolState.idolId);
    if (!idol) continue;
    for (const mod of idol.modifiers) {
      modifiers.push({
        ...mod,
        id: `${mod.id}-idol-${index}`,
        sourceType: "idol",
        sourceId: idol.id,
      });
    }

    // User-added idol affixes (same roll-resolution behavior as equipment affixes)
    for (const roll of idolState.affixes ?? []) {
      const affixDef = gameData.affixes.find((a) => a.id === roll.affixId);
      if (!affixDef) continue;

      modifiers.push({
        id: `${idol.id}-${affixDef.id}-t${roll.tier}`,
        sourceType: "idol",
        sourceId: idol.id,
        targetStat: affixDef.targetStat as Modifier["targetStat"],
        operation: affixDef.operation as Modifier["operation"],
        value: roll.value,
        tags: affixDef.tags,
      });

      if (affixDef.additionalProperties && affixDef.additionalProperties.length > 0) {
        const tierDef = affixDef.tiers.find((t) => t.tier === roll.tier);
        if (!tierDef) continue;

        const primarySpan = tierDef.maxValue - tierDef.minValue;
        const normalizedPrimaryValue =
          Math.abs(roll.value) > 1 && Math.abs(tierDef.maxValue) <= 1
            ? roll.value / 100
            : roll.value;
        const rawRatio =
          primarySpan === 0 ? 0 : (normalizedPrimaryValue - tierDef.minValue) / primarySpan;
        const rollRatio = Math.min(1, Math.max(0, rawRatio));

        for (const extra of affixDef.additionalProperties) {
          const extraRange = tierDef.extraRolls?.[extra.extraRollIndex];
          if (!extraRange) continue;
          const extraValue =
            extraRange.minValue + rollRatio * (extraRange.maxValue - extraRange.minValue);

          modifiers.push({
            id: `${idol.id}-${affixDef.id}-t${roll.tier}-x${extra.extraRollIndex + 1}`,
            sourceType: "idol",
            sourceId: idol.id,
            targetStat: extra.targetStat as Modifier["targetStat"],
            operation: extra.operation as Modifier["operation"],
            value: extraValue,
            tags: affixDef.tags,
          });
        }
      }
    }
  }

  // 6. Imported extras (e.g. maxroll altar/idol entries)
  if (build.extraModifiers && build.extraModifiers.length > 0) {
    modifiers.push(...build.extraModifiers);
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
