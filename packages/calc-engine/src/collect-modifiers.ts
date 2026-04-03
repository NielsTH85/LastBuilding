import type { Build } from "@eob/build-model";
import type { GameData, Modifier, PassiveTreeDef, Condition } from "@eob/game-data";

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

  const equippedIdols = build.idols
    .map((state, index) => ({
      state,
      index,
      def: gameData.idols.find((i) => i.id === state.idolId),
    }))
    .filter(
      (entry): entry is { state: Build["idols"][number]; index: number; def: GameData["idols"][number] } =>
        Boolean(entry.def),
    );

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
      for (const [index, impl] of baseDef.implicits.entries()) {
        let value = impl.value;
        const roll = item.implicitRolls?.[index];
        const display = baseDef.implicitDisplays?.[index];

        if (roll != null && display) {
          const rawValue = display.value + roll * (display.maxValue - display.value);
          if (impl.operation === "increased" || impl.operation === "more") {
            value = Math.abs(rawValue) <= 1 ? rawValue * 100 : rawValue;
          } else {
            value = rawValue;
          }
        }

        modifiers.push({
          ...impl,
          value,
        });
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

    // Sealed affixes
    for (const roll of item.seals ?? []) {
      const affixDef = gameData.affixes.find((a) => a.id === roll.affixId);
      if (affixDef) {
        modifiers.push({
          id: `${affixDef.id}-t${roll.tier}-seal`,
          sourceType: "item",
          sourceId: item.baseId,
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
              id: `${affixDef.id}-t${roll.tier}-seal-x${extra.extraRollIndex + 1}`,
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

  const altarDef = build.idolAltarId
    ? gameData.idolAltars.find((a) => a.id === build.idolAltarId)
    : undefined;
  const refractedSlots = new Set<number>(altarDef?.refractedSlots ?? []);
  let refractedPrefixInc = 0;
  let refractedSuffixInc = 0;
  let refractedWeaverInc = 0;
  let maxWeaverIdols = Number.POSITIVE_INFINITY;
  let maxHereticalIdols = Number.POSITIVE_INFINITY;
  let maxAdornedIdols = Number.POSITIVE_INFINITY;
  let maxCorruptedIdols = Number.POSITIVE_INFINITY;
  for (const effect of altarDef?.effects ?? []) {
    if (effect.propertyId === 1) {
      const pct = normalizePercentScalar(effect.value);
      refractedPrefixInc += pct;
      refractedSuffixInc += pct;
    }
    if (effect.propertyId === 2) {
      refractedPrefixInc += normalizePercentScalar(effect.value);
    }
    if (effect.propertyId === 3) {
      refractedSuffixInc += normalizePercentScalar(effect.value);
    }
    if (effect.propertyId === 4) {
      refractedWeaverInc += normalizePercentScalar(effect.value);
    }
    if (effect.propertyId === 5) {
      maxWeaverIdols = Math.max(0, Math.floor(effect.value));
    }
    if (effect.propertyId === 6) {
      maxHereticalIdols = Math.max(0, Math.floor(effect.value));
    }
    if (effect.propertyId === 7) {
      maxAdornedIdols = Math.max(0, Math.floor(effect.value));
    }
    if (effect.propertyId === 8) {
      maxCorruptedIdols = Math.max(0, Math.floor(effect.value));
    }
  }

  const enabledIdolIndices = getEnabledIdolIndicesByAltarCaps(equippedIdols, {
    weaver: maxWeaverIdols,
    heretical: maxHereticalIdols,
    adorned: maxAdornedIdols,
    corrupted: maxCorruptedIdols,
  });

  // 5. Idols
  for (const entry of equippedIdols) {
    const { index, state: idolState, def: idol } = entry;
    if (!enabledIdolIndices.has(index)) continue;

    const idolCategories = getIdolCategories(idol.name);
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

      const isRefracted =
        idolState.slotIndex != null && refractedSlots.has(idolState.slotIndex);
      let refractedScale = isRefracted
        ? getRefractedAffixScale(affixDef.type, refractedPrefixInc, refractedSuffixInc)
        : 1;
      if (isRefracted && idolCategories.weaver && refractedWeaverInc !== 0) {
        refractedScale *= 1 + refractedWeaverInc / 100;
      }

      modifiers.push({
        id: `${idol.id}-${affixDef.id}-t${roll.tier}`,
        sourceType: "idol",
        sourceId: idol.id,
        targetStat: affixDef.targetStat as Modifier["targetStat"],
        operation: affixDef.operation as Modifier["operation"],
        value: roll.value * refractedScale,
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
            value: extraValue * refractedScale,
            tags: affixDef.tags,
          });
        }
      }
    }
  }

  // 6. Idol altar effects
  if (altarDef) {
    const effectiveIdols = equippedIdols.filter((entry) => enabledIdolIndices.has(entry.index));

    const refractedCount = effectiveIdols.filter(
      (entry) => entry.state.slotIndex != null && refractedSlots.has(entry.state.slotIndex),
    ).length;
    const hereticalCount = effectiveIdols.filter((entry) => getIdolCategories(entry.def.name).heretical).length;
    const ornateCount = effectiveIdols.filter((entry) =>
      entry.def.name.toLowerCase().includes("ornate"),
    ).length;
    const hugeCount = effectiveIdols.filter((entry) =>
      entry.def.name.toLowerCase().includes("huge"),
    ).length;
    const omenCount = effectiveIdols.filter((entry) =>
      entry.def.name.toLowerCase().includes("omen"),
    ).length;
    const corruptedCount = effectiveIdols.filter((entry) => getIdolCategories(entry.def.name).corrupted).length;
    const uniqueLegendaryCount = effectiveIdols.filter((entry) => {
      const name = entry.def.name.toLowerCase();
      return name.includes("unique") || name.includes("legendary");
    }).length;
    const noLargerAboveSmaller = !hasLargerAboveSmaller(effectiveIdols, altarDef.layout.cols);

    for (const effect of altarDef.effects) {
      const mapped = mapAltarEffect(effect.propertyId);
      if (!mapped) continue;

      let count = 0;
      switch (effect.propertyId) {
        case 9:
        case 10:
        case 11:
        case 12:
          count = corruptedCount;
          break;
        case 13:
        case 14:
        case 15:
          count = hereticalCount;
          break;
        case 16:
          count = ornateCount;
          break;
        case 17:
          count = hugeCount;
          break;
        case 19:
        case 18:
          count = omenCount;
          break;
        case 20:
          count = uniqueLegendaryCount;
          break;
        case 21:
          count = noLargerAboveSmaller ? 1 : 0;
          break;
        case 22:
        case 23:
        case 24:
        case 25:
          count = refractedCount;
          break;
        default:
          count = 0;
      }

      if (count <= 0) continue;

      const rawValue = effect.value * count;
      const normalizedValue =
        (mapped.operation === "increased" || mapped.operation === "more") &&
        Math.abs(rawValue) <= 1
          ? rawValue * 100
          : rawValue;

      modifiers.push({
        id: `altar-${altarDef.id}-p${effect.propertyId}`,
        sourceType: "idol",
        sourceId: altarDef.id,
        targetStat: mapped.stat as Modifier["targetStat"],
        operation: mapped.operation,
        value: normalizedValue,
      });
    }
  }

  // 7. Imported extras (e.g. maxroll altar/idol entries)
  if (build.extraModifiers && build.extraModifiers.length > 0) {
    modifiers.push(...build.extraModifiers);
  }

  // 8. Custom modifiers from simulation config
  if (build.config.customModifiers && build.config.customModifiers.length > 0) {
    for (const [i, cm] of build.config.customModifiers.entries()) {
      modifiers.push({
        id: `custom-mod-${i}`,
        sourceType: "config",
        sourceId: "custom",
        targetStat: cm.targetStat as Modifier["targetStat"],
        operation: cm.operation as Modifier["operation"],
        value: cm.value,
      });
    }
  }

  // 9. Blessings
  for (const blessingState of build.blessings) {
    const blessingDef = gameData.blessings?.find((b) => b.id === blessingState.blessingId);
    if (!blessingDef) continue;
    for (const mod of blessingDef.modifiers) {
      modifiers.push({
        ...mod,
        id: `blessing-${blessingDef.id}-${mod.targetStat}`,
        sourceType: "blessing",
        sourceId: blessingDef.id,
      });
    }
  }

  // Filter out modifiers whose conditions are not met
  return filterByConditions(modifiers, build, gameData);
}

function findPassiveNode(nodeId: string, trees: PassiveTreeDef[]) {
  for (const tree of trees) {
    const node = tree.nodes.find((n) => n.id === nodeId);
    if (node) return node;
  }
  return undefined;
}

/**
 * Evaluate whether a single condition is satisfied by the current build state.
 */
function evaluateCondition(condition: Condition, build: Build, gameData: GameData): boolean {
  switch (condition.type) {
    case "toggle": {
      // Check if the named toggle is active in the build
      const toggle = build.toggles.find((t) => t.id === condition.value);
      if (toggle) return toggle.active;

      // Fall back to simulation config flags so config checkboxes can
      // satisfy toggle-based conditions from imported data.
      const key = condition.value.toLowerCase().replace(/[\s-]+/g, "_");
      if (["player_at_full_health", "at_full_health", "full_health"].includes(key)) {
        return build.config.playerAtFullHealth ?? false;
      }
      if (["player_has_ward", "has_ward"].includes(key)) {
        return build.config.playerHasWard ?? false;
      }
      if (
        [
          "player_recently_used_potion",
          "recently_used_potion",
          "used_potion_recently",
        ].includes(key)
      ) {
        return build.config.playerRecentlyUsedPotion ?? false;
      }
      if (["player_recently_killed", "recently_killed", "killed_recently"].includes(key)) {
        return build.config.playerRecentlyKilled ?? false;
      }
      if (
        [
          "player_recently_been_hit",
          "player_recently_hit",
          "recently_been_hit",
          "recently_hit",
        ].includes(key)
      ) {
        return build.config.playerRecentlyBeenHit ?? false;
      }
      return false;
    }
    case "skill_tag": {
      // True if the build has any skill with the specified tag
      return build.skills.some((sa) => {
        const skill = gameData.skills.find((s) => s.id === sa.skillId);
        return skill?.tags?.includes(condition.value) ?? false;
      });
    }
    case "damage_type": {
      // Always true — damage type conditions are handled at the derived stage
      // by filtering which increased damage bonuses apply
      return true;
    }
    case "weapon_type": {
      // True if any equipped weapon matches the required type tag
      const weapons = [build.equipment.weapon1, build.equipment.weapon2].filter(Boolean);
      return weapons.some((w) => {
        const base = gameData.itemBases.find((b) => b.id === w!.baseId);
        return base?.tags?.includes(condition.value) ?? false;
      });
    }
    case "min_attribute": {
      // Threshold check: would need resolved stats so we conservatively pass
      // (the stat pipeline naturally handles this as a check at resolution time)
      return true;
    }
    default:
      return true;
  }
}

/**
 * Filter modifiers by their conditions.
 * A modifier with no conditions always passes.
 * A modifier with conditions passes only if ALL conditions are met.
 */
function filterByConditions(
  modifiers: Modifier[],
  build: Build,
  gameData: GameData,
): Modifier[] {
  return modifiers.filter((mod) => {
    if (!mod.conditions || mod.conditions.length === 0) return true;
    return mod.conditions.every((c) => evaluateCondition(c, build, gameData));
  });
}

function normalizePercentScalar(value: number): number {
  return Math.abs(value) <= 1 ? value * 100 : value;
}

function getRefractedAffixScale(
  affixType: string,
  prefixIncPercent: number,
  suffixIncPercent: number,
): number {
  if (affixType === "prefix") return 1 + prefixIncPercent / 100;
  if (affixType === "suffix") return 1 + suffixIncPercent / 100;
  return 1;
}

function mapAltarEffect(propertyId: number): { stat: string; operation: Modifier["operation"] } | null {
  switch (propertyId) {
    case 9:
      return { stat: "dodge_rating", operation: "add" };
    case 10:
      return { stat: "mana", operation: "add" };
    case 11:
      return { stat: "armor", operation: "add" };
    case 12:
      // Ward decay threshold is modeled as retention in this first-pass approximation.
      return { stat: "ward_retention", operation: "add" };
    case 13:
      return { stat: "health", operation: "add" };
    case 14:
      return { stat: "ward_generation", operation: "add" };
    case 15:
      // Crit-only mitigation is approximated as generic less damage taken.
      return { stat: "less_damage_taken", operation: "add" };
    case 16:
      return { stat: "mana_regen", operation: "increased" };
    case 17:
      return { stat: "health", operation: "increased" };
    case 18:
      // Haste-effect scaling is approximated as movement speed increase.
      return { stat: "movement_speed", operation: "increased" };
    case 19:
      return { stat: "health", operation: "add" };
    case 20:
      return { stat: "damage_to_bosses", operation: "more" };
    case 21:
      return { stat: "cooldown_recovery_speed", operation: "increased" };
    case 22:
      return { stat: "health", operation: "add" };
    case 23:
      return { stat: "mana", operation: "add" };
    case 24:
      return { stat: "armor", operation: "add" };
    case 25:
      // Ward decay threshold is modeled as retention in this first-pass approximation.
      return { stat: "ward_retention", operation: "add" };
    default:
      return null;
  }
}

function getIdolCategories(name: string): {
  weaver: boolean;
  heretical: boolean;
  adorned: boolean;
  corrupted: boolean;
} {
  const lower = name.toLowerCase();
  return {
    weaver: lower.includes("weaver"),
    heretical: lower.includes("heretical"),
    adorned: lower.includes("adorned"),
    // Corrupted idols are currently represented by Lagonian idol names in imported data.
    corrupted: lower.includes("corrupted") || lower.includes("lagonian"),
  };
}

function getEnabledIdolIndicesByAltarCaps(
  idols: Array<{
    state: Build["idols"][number];
    index: number;
    def: GameData["idols"][number];
  }>,
  caps: { weaver: number; heretical: number; adorned: number; corrupted: number },
): Set<number> {
  const enabled = new Set<number>();
  const used = {
    weaver: 0,
    heretical: 0,
    adorned: 0,
    corrupted: 0,
  };

  for (const idol of idols) {
    const categories = getIdolCategories(idol.def.name);

    if (categories.weaver && used.weaver >= caps.weaver) continue;
    if (categories.heretical && used.heretical >= caps.heretical) continue;
    if (categories.adorned && used.adorned >= caps.adorned) continue;
    if (categories.corrupted && used.corrupted >= caps.corrupted) continue;

    enabled.add(idol.index);
    if (categories.weaver) used.weaver += 1;
    if (categories.heretical) used.heretical += 1;
    if (categories.adorned) used.adorned += 1;
    if (categories.corrupted) used.corrupted += 1;
  }

  return enabled;
}

function hasLargerAboveSmaller(
  idols: Array<{ state: Build["idols"][number]; def: GameData["idols"][number] }>,
  cols: number,
): boolean {
  const placed = idols.filter((entry) => entry.state.slotIndex != null);

  for (const a of placed) {
    const aIndex = a.state.slotIndex!;
    const aRow = Math.floor(aIndex / cols);
    const aCol = aIndex % cols;
    const aSize = a.def.size.width * a.def.size.height;

    for (const b of placed) {
      if (a === b) continue;

      const bIndex = b.state.slotIndex!;
      const bRow = Math.floor(bIndex / cols);
      const bCol = bIndex % cols;
      const bSize = b.def.size.width * b.def.size.height;

      if (aSize <= bSize) continue;
      if (aRow >= bRow) continue;

      const overlapHorizontally =
        aCol < bCol + b.def.size.width && bCol < aCol + a.def.size.width;
      if (overlapHorizontally) return true;
    }
  }

  return false;
}
