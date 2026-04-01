import type { Modifier } from "../modifiers.js";

export type ItemSlot =
  | "helmet"
  | "bodyArmor"
  | "gloves"
  | "boots"
  | "weapon1"
  | "weapon2"
  | "relic"
  | "belt"
  | "ring1"
  | "ring2"
  | "amulet";

export type ItemRarity = "normal" | "magic" | "rare" | "exalted" | "unique" | "set";

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: ItemSlot;
  levelRequirement: number;
  classRequirement?: string;
  implicits: Modifier[];
  tags: string[];
}

export interface AffixTier {
  tier: number;
  minValue: number;
  maxValue: number;
  levelRequirement: number;
}

export interface AffixDef {
  id: string;
  name: string;
  type: "prefix" | "suffix";
  targetStat: string;
  operation: string;
  tiers: AffixTier[];
  tags: string[];
}

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  modifiers: Modifier[];
}

export interface IdolDef {
  id: string;
  name: string;
  size: { width: number; height: number };
  modifiers: Modifier[];
  classRequirement?: string;
}
