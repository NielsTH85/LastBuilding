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
  SkillBaselineDef,
  SkillSpeedType,
  ItemSlot,
  ItemRarity,
  ItemBaseDef,
  ImplicitDisplay,
  AffixTier,
  AffixDef,
  BlessingDef,
  IdolDef,
  UniqueItemDef,
} from "./types/index.js";

// Real game data (imported from maxroll)
export {
  getImportedClasses,
  getImportedClass,
  getImportedMageClass,
  getImportedMageClass as mageClass,
  getImportedPassiveTrees,
  getImportedSkills,
} from "./data/maxroll-adapter.js";
export { getNodeStatDescriptions } from "./data/maxroll-adapter.js";
export { getSkillIcon, getNodeIcon, DEFAULT_NODE_ICON } from "./data/icon-mapping.js";

// Maxroll build import
export {
  parseMaxrollUrl,
  convertMaxrollBuild,
  convertMaxrollProfile,
  MAXROLL_API_URL,
} from "./data/maxroll-build-import.js";
export type {
  MaxrollApiResponse,
  MaxrollBuildData,
  MaxrollProfile,
  ImportedBuild,
  ImportedEquipmentItem,
  ImportResult,
} from "./data/maxroll-build-import.js";

// Legacy stub data (items/affixes still use stubs)
export { itemBases } from "./data/items.js";
export { affixes } from "./data/affixes.js";

// Unique items
export { uniqueItems, getUniqueItem, convertUniqueMods } from "./data/uniques-adapter.js";

// Item sprites
export { getItemSprite, getUniqueSprite } from "./data/item-sprites.js";

// Item display helpers
export { getPropertyName, getUniqueModDisplay, isComplexProperty, hasComplexDisplayOverride } from "./data/item-display.js";
export { formatTooltipDescription } from "./data/item-display.js";
export type { UniqueModDisplay } from "./data/item-display.js";

// Convenience: all game data in one object
import { getImportedClasses, getImportedPassiveTrees, getImportedSkills } from "./data/maxroll-adapter.js";
import { itemBases } from "./data/items.js";
import { affixes } from "./data/affixes.js";
import { DEFAULT_IDOL_GRID, IDOL_ALTARS, IDOL_TYPE_SIZES } from "./data/idol-altar-data.js";
import type { ClassDef, PassiveTreeDef, SkillDef, ItemBaseDef, AffixDef, IdolDef, IdolAltarDef } from "./types/index.js";

function getBaseTypeId(baseId: string): number | null {
  const parts = baseId.split("-");
  if (parts.length < 3) return null;
  const parsed = Number(parts[parts.length - 2]);
  return Number.isFinite(parsed) ? parsed : null;
}

function deriveIdols(bases: ItemBaseDef[]): IdolDef[] {
  return bases
    .filter((b) => b.tags.includes("idol"))
    .map((b) => {
      const baseTypeId = getBaseTypeId(b.id) ?? undefined;
      const size = (baseTypeId != null ? IDOL_TYPE_SIZES[baseTypeId] : undefined) ?? { width: 1, height: 1 };
      return {
        id: b.id,
        name: b.name,
        baseTypeId,
        size,
        modifiers: b.implicits,
        classRequirement: b.classRequirement,
      };
    });
}

export interface GameData {
  classes: ClassDef[];
  passiveTrees: PassiveTreeDef[];
  skills: SkillDef[];
  itemBases: ItemBaseDef[];
  affixes: AffixDef[];
  idols: IdolDef[];
  idolAltars: IdolAltarDef[];
  idolGrid: { rows: number; cols: number };
}

export function getGameData(): GameData {
  const idols = deriveIdols(itemBases);
  return {
    classes: getImportedClasses(),
    passiveTrees: getImportedPassiveTrees(),
    skills: getImportedSkills(),
    itemBases,
    affixes,
    idols,
    idolAltars: IDOL_ALTARS,
    idolGrid: { rows: DEFAULT_IDOL_GRID.rows, cols: DEFAULT_IDOL_GRID.cols },
  };
}
