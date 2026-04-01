import type { Modifier } from "../modifiers.js";

export interface ClassDef {
  id: string;
  name: string;
  baseStats: Record<string, number>;
  masteries: MasteryDef[];
}

export interface MasteryDef {
  id: string;
  name: string;
  classId: string;
  bonusStats?: Record<string, number>;
}

export interface PassiveNodeDef {
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

export interface PassiveTreeDef {
  id: string;
  classId: string;
  masteryId?: string;
  name: string;
  nodes: PassiveNodeDef[];
}
