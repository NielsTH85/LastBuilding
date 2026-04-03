import type { Build, BuildSnapshot } from "@eob/build-model";
import type { GameData } from "@eob/game-data";
import { collectModifiers } from "./collect-modifiers.js";
import { aggregateModifiers } from "./aggregate.js";
import { resolveAllStats } from "./resolve-stats.js";
import { computeDerivedStats } from "./derived.js";
import { buildSnapshot } from "./snapshot.js";

/**
 * Compute a full build snapshot.
 * This is the main public API of the calc engine.
 *
 * Pipeline:
 *  1. Collect all active modifiers
 *  2. Aggregate by target stat and operation
 *  3. Resolve each stat through the pipeline
 *  4. Compute derived stats
 *  5. Build immutable snapshot
 */
export function computeSnapshot(
  build: Build,
  gameData: GameData,
  activeSkillId?: string,
): BuildSnapshot {
  const modifiers = collectModifiers(build, gameData, activeSkillId);
  const aggregated = aggregateModifiers(modifiers);
  const resolved = resolveAllStats(aggregated);

  const hasActiveSkill = !!activeSkillId && build.skills.some((s) => s.skillId === activeSkillId);
  const activeSkill = hasActiveSkill
    ? gameData.skills.find((s) => s.id === activeSkillId)
    : undefined;

  computeDerivedStats(resolved, {
    activeSkillId,
    activeSkillTags: activeSkill?.tags,
    activeSkillBaseline: activeSkill?.baseline
      ? {
          speedType: activeSkill.baseline.speedType,
          baseHitsPerSecond: activeSkill.baseline.baseHitsPerSecond,
          baseDamage: activeSkill.baseline.baseDamage,
          addedDamageEffectiveness: activeSkill.baseline.addedDamageEffectiveness,
          baseCooldown: activeSkill.baseCooldown,
          baseManaCost: activeSkill.baseMana,
        }
      : undefined,
    simulationConfig: build.config,
  });
  return buildSnapshot(resolved, aggregated);
}
