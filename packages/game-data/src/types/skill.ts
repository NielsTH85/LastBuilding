import type { Modifier } from "../modifiers.js";

export interface SkillDef {
  id: string;
  name: string;
  classId: string;
  masteryId?: string;
  description: string;
  baseCooldown?: number;
  baseMana?: number;
  tags: string[];
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
}
