import type { StatId } from "./stats.js";

/** Where a modifier originates from */
export type ModifierSourceType =
  | "passive"
  | "skillNode"
  | "item"
  | "implicit"
  | "blessing"
  | "idol"
  | "buff"
  | "base"
  | "config";

/** How a modifier applies to the stat pipeline */
export type ModifierOperation =
  | "add" // flat additive
  | "increased" // additive percentage (sums with other increased)
  | "more" // multiplicative percentage (multiplies independently)
  | "set" // override base
  | "override"; // force final value

export interface Condition {
  type: "skill_tag" | "damage_type" | "weapon_type" | "toggle" | "min_attribute";
  value: string;
  threshold?: number;
}

/**
 * Core modifier — the universal unit of stat modification.
 * Every passive node, skill node, affix, implicit, blessing, idol, and buff
 * produces one or more of these.
 */
export interface Modifier {
  id: string;
  sourceType: ModifierSourceType;
  sourceId: string;
  targetStat: StatId;
  operation: ModifierOperation;
  value: number;
  conditions?: Condition[];
  tags?: string[];
}
