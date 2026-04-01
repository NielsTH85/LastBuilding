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
export function computeSnapshot(build: Build, gameData: GameData): BuildSnapshot {
  const modifiers = collectModifiers(build, gameData);
  const aggregated = aggregateModifiers(modifiers);
  const resolved = resolveAllStats(aggregated);
  computeDerivedStats(resolved);
  return buildSnapshot(resolved, aggregated);
}
