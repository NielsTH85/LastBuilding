// Stat registry
export { STAT_IDS, STAT_ID_SET } from "./stats.js";
export type { StatId } from "./stats.js";

// Modifier types
export type {
  Modifier,
  ModifierSourceType,
  ModifierOperation,
  Condition,
} from "./modifiers.js";

// Data schemas
export type {
  ClassDef,
  MasteryDef,
  PassiveNodeDef,
  PassiveTreeDef,
  SkillDef,
  SkillTreeDef,
  SkillNodeDef,
  ItemSlot,
  ItemRarity,
  ItemBaseDef,
  AffixTier,
  AffixDef,
  BlessingDef,
  IdolDef,
} from "./types/index.js";

// Stub data
export { mageClass } from "./data/classes.js";
export { mageBasePassives, runemasterPassives } from "./data/passives.js";
export { allSkills, runicInvocation, flameWard, glacier } from "./data/skills.js";
export { itemBases } from "./data/items.js";
export { affixes } from "./data/affixes.js";

// Convenience: all game data in one object
import { mageClass } from "./data/classes.js";
import { mageBasePassives, runemasterPassives } from "./data/passives.js";
import { allSkills } from "./data/skills.js";
import { itemBases } from "./data/items.js";
import { affixes } from "./data/affixes.js";
import type { ClassDef, PassiveTreeDef, SkillDef, ItemBaseDef, AffixDef } from "./types/index.js";

export interface GameData {
  classes: ClassDef[];
  passiveTrees: PassiveTreeDef[];
  skills: SkillDef[];
  itemBases: ItemBaseDef[];
  affixes: AffixDef[];
}

export function getGameData(): GameData {
  return {
    classes: [mageClass],
    passiveTrees: [mageBasePassives, runemasterPassives],
    skills: allSkills,
    itemBases,
    affixes,
  };
}
