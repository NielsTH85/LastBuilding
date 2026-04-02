import type { Modifier } from "../modifiers.js";

export type SkillSpeedType = "attack" | "cast" | "auto";

export interface SkillBaselineDef {
  abilityKey: string;
  speedType: SkillSpeedType;
  useDuration: number;
  baseHitsPerSecond: number;
  baseDamage: number;
  addedDamageEffectiveness: number;
  speedScaler: number;
  speedMultiplier: number;
}

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  masteryId?: string;
  description: string;
  baseCooldown?: number;
  baseMana?: number;
  tags: string[];
  icon?: string;
  baseline?: SkillBaselineDef;
  tree: SkillTreeDef;
}

export interface SkillTreeDef {
  id: string;
  skillId: string;
  nodes: SkillNodeDef[];
}

export interface SkillNodeDef {
  id: string;
  treeId: string;
  name: string;
  description: string;
  maxPoints: number;
  position: { x: number; y: number };
  prerequisites: string[];
  modifiersPerPoint: Modifier[];
  tags?: string[];
  icon?: string;
}
