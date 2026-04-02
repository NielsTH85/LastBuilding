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
  | "amulet"
  | "idol"
  | "idolAltar";

export type ItemRarity = "normal" | "magic" | "rare" | "exalted" | "unique" | "set";

export interface ImplicitDisplay {
  propertyName: string;
  value: number;
  maxValue: number;
  displayAsPercentage?: boolean;
}

export interface ItemBaseDef {
  id: string;
  name: string;
  slot: ItemSlot;
  levelRequirement: number;
  classRequirement?: string;
  typeName?: string;
  attackRate?: number;
  weaponRange?: number;
  implicits: Modifier[];
  implicitDisplays?: ImplicitDisplay[];
  tags: string[];
}

export interface AffixTier {
  tier: number;
  minValue: number;
  maxValue: number;
  levelRequirement: number;
  extraRolls?: { minValue: number; maxValue: number }[];
}

export interface AffixAdditionalProperty {
  targetStat: string;
  operation: string;
  /** Index into tier.extraRolls (0-based). */
  extraRollIndex: number;
}

export interface AffixDef {
  id: string;
  name: string;
  type: "prefix" | "suffix";
  targetStat: string;
  operation: string;
  tiers: AffixTier[];
  tags: string[];
  additionalProperties?: AffixAdditionalProperty[];
}

export interface BlessingDef {
  id: string;
  name: string;
  description: string;
  modifiers: Modifier[];
}

export interface UniqueModDef {
  property: number;
  value: number;
  canRoll?: boolean;
  maxValue?: number;
  tags: number;
  /** Ailment/effect sub-type: 1=Ignite, 2=Bleed, 3=Chill, 5=Shock, 6=Slow, 7=Poison, etc. */
  specialTag?: number;
  /** 0=flat, 1=increased, 2=more */
  type?: number;
  /** Whether this mod is hidden in the standard tooltip */
  hideInTooltip?: boolean;
}

export interface UniqueItemDef {
  uniqueId: number;
  name: string;
  displayName?: string;
  baseType: number;
  subTypes: number[];
  mods: UniqueModDef[];
  tooltipDescriptions?: string[];
  isSetItem?: boolean;
  setId?: number;
  levelRequirement?: number;
  legendaryType?: number;
  isPrimordialItem?: boolean;
  loreText?: string;
}

export interface IdolDef {
  id: string;
  name: string;
  baseTypeId?: number;
  size: { width: number; height: number };
  modifiers: Modifier[];
  classRequirement?: string;
}

export interface IdolAltarEffect {
  propertyId: number;
  propertyName: string;
  operation: "add" | "increased" | "more";
  value: number;
  maxValue: number;
}

export interface IdolAltarDef {
  id: string;
  name: string;
  subTypeId: number;
  layout: { rows: number; cols: number };
  slotIndices: number[];
  blockedSlots: number[];
  refractedSlots: number[];
  effects: IdolAltarEffect[];
}
