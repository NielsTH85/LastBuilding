import type { IdolAltarDef, IdolAltarEffect } from "../types/index.js";

// 17 usable idol slots in a 5x5 board, with blocked indices represented explicitly.
export const DEFAULT_IDOL_GRID = { rows: 5, cols: 5 } as const;
export const DEFAULT_IDOL_SLOT_INDICES = Array.from(
  { length: DEFAULT_IDOL_GRID.rows * DEFAULT_IDOL_GRID.cols },
  (_, i) => i,
);

export const IDOL_TYPE_SIZES: Record<number, { width: number; height: number }> = {
  25: { width: 1, height: 1 }, // Small Idol
  26: { width: 1, height: 1 }, // Minor/Small Lagonian Idol
  27: { width: 2, height: 1 }, // Humble Idol
  28: { width: 1, height: 2 }, // Stout Idol
  29: { width: 3, height: 1 }, // Grand Idol
  30: { width: 1, height: 3 }, // Large Idol
  31: { width: 4, height: 1 }, // Ornate Idol
  32: { width: 1, height: 4 }, // Huge Idol
  33: { width: 2, height: 2 }, // Adorned Idol
};

const IDOL_ALTAR_PROPERTY_NAMES = [
  "Maximum Omen Idols",
  "Effect of Prefixes and Suffixes for Idols in Refracted Slots",
  "Effect of Prefixes for Idols in Refracted Slots",
  "Effect of Suffixes for Idols in Refracted Slots",
  "Effect of Weaver Enchantment Affixes for Idols in Refracted Slots",
  "Weaver Idols equipped at Maximum",
  "Heretical Idols equipped at Maximum",
  "Adorned Idols equipped at Maximum",
  "Corrupted Idols equipped at Maximum",
  "Dodge Rating per Equipped Corrupted Idol",
  "Mana per Equipped Corrupted Idol",
  "Armor per Equipped Corrupted Idol",
  "Ward Decay Threshold per Equipped Corrupted Idol",
  "Health per Equipped Heretical Idol",
  "Ward per Second per Equipped Heretical Idol",
  "Reduced Bonus Damage Taken from Critical Strikes per Equipped Heretical Idol",
  "increased Mana Regen per Equipped Ornate Idol",
  "increased Health per Equipped Huge Idol",
  "increased Effect of Haste on You per Equipped Omen Idol",
  "Health per Equipped Omen Idol",
  "Damage to Bosses per Equipped Unique or Legendary Idol",
  "Increased Cooldown Recovery Speed if there are no larger idols above smaller ones in the grid",
  "Health per Idol in a Refracted Slot",
  "Mana per Idol in a Refracted Slot",
  "Armor per Idol in a Refracted Slot",
  "Ward Decay Threshold per Idol in a Refracted Slot",
] as const;

interface RawAltarEffect {
  propertyId: number;
  operationType: 0 | 1 | 2;
  value: number;
  maxValue: number;
}

interface RawAltar {
  subTypeId: number;
  name: string;
  effects: RawAltarEffect[];
}

const RAW_ALTARS: RawAltar[] = [
  { subTypeId: 0, name: "Twisted Altar", effects: [] },
  {
    subTypeId: 1,
    name: "Jagged Altar",
    effects: [{ propertyId: 5, operationType: 0, value: 2, maxValue: 2 }],
  },
  { subTypeId: 2, name: "Skyward Altar", effects: [] },
  {
    subTypeId: 3,
    name: "Spire Altar",
    effects: [{ propertyId: 23, operationType: 0, value: 7, maxValue: 24 }],
  },
  {
    subTypeId: 4,
    name: "Carcinised Altar",
    effects: [{ propertyId: 24, operationType: 0, value: 64, maxValue: 256 }],
  },
  {
    subTypeId: 5,
    name: "Visage Altar",
    effects: [{ propertyId: 19, operationType: 0, value: 6, maxValue: 10 }],
  },
  { subTypeId: 6, name: "Lunar Altar", effects: [] },
  {
    subTypeId: 7,
    name: "Ocular Altar",
    effects: [{ propertyId: 7, operationType: 0, value: 2, maxValue: 2 }],
  },
  { subTypeId: 8, name: "Archaic Altar", effects: [] },
  {
    subTypeId: 9,
    name: "Impervious Altar",
    effects: [
      { propertyId: 12, operationType: 0, value: 15, maxValue: 35 },
      { propertyId: 5, operationType: 0, value: 2, maxValue: 2 },
    ],
  },
  {
    subTypeId: 10,
    name: "Prophesied Altar",
    effects: [{ propertyId: 3, operationType: 1, value: 0.1, maxValue: 0.4 }],
  },
  {
    subTypeId: 11,
    name: "Pyramidal Altar",
    effects: [
      { propertyId: 21, operationType: 0, value: 0.1, maxValue: 0.1 },
      { propertyId: 5, operationType: 0, value: 2, maxValue: 2 },
    ],
  },
  {
    subTypeId: 12,
    name: "Auric Altar",
    effects: [{ propertyId: 20, operationType: 2, value: 0.02, maxValue: 0.02 }],
  },
];

// Per-altar grid shapes extracted from game data.
// Each altar defines a 5×5 grid where cells are Blocked (X), Refracted (R), or Unlocked (space).
const ALTAR_GRID_SHAPES: Record<number, string[]> = {
  0: ["XR   ", "  XX ", " RXR ", " XX  ", "   RX"], // Twisted
  1: ["X   X", "R   R", "X   X", "R   R", "X   X"], // Jagged
  2: ["XXRXX", "X   X", "R   R", "  R  ", "  X  "], // Skyward
  3: ["RXX  ", "  X  ", "  R  ", "  X  ", "  XXR"], // Spire
  4: ["  X  ", " XXX ", " R R ", "X   X", "     "], // Carcinised
  5: ["X   X", "RR RR", " X X ", "     ", "X   X"], // Visage
  6: ["X    ", "    X", "RRRXX", "    X", "X    "], // Lunar
  7: ["R   R", "  X  ", " XXX ", "  X  ", "R   R"], // Ocular
  8: ["X R X", "     ", "  X  ", "     ", "X R X"], // Archaic
  9: ["X   X", "X X X", " RRR ", " RRR ", "     "], // Impervious
  10: ["X   X", "     ", "  R  ", "     ", "X   X"], // Prophesied
  11: ["XX XX", "X R X", "  R  ", " R R ", "R   R"], // Pyramidal
  12: ["  R  ", "  X  ", "X R X", "  X  ", "  R  "], // Auric
};

function parseAltarGrid(shape: string[]): { blocked: number[]; refracted: number[] } {
  const blocked: number[] = [];
  const refracted: number[] = [];
  for (let r = 0; r < 5; r++) {
    for (let c = 0; c < 5; c++) {
      const ch = shape[r]![c];
      const slot = r * 5 + c;
      if (ch === "X") blocked.push(slot);
      else if (ch === "R") refracted.push(slot);
    }
  }
  return { blocked, refracted };
}

const DEFAULT_BLOCKED_SLOTS = [0, 4, 12, 20, 24];

function toEffect(raw: RawAltarEffect): IdolAltarEffect {
  const propertyName =
    IDOL_ALTAR_PROPERTY_NAMES[raw.propertyId] ?? `Idol Altar Property ${raw.propertyId}`;
  const operation: IdolAltarEffect["operation"] =
    raw.operationType === 2 ? "more" : raw.operationType === 1 ? "increased" : "add";

  return {
    propertyId: raw.propertyId,
    propertyName,
    operation,
    value: raw.value,
    maxValue: raw.maxValue,
  };
}

export const IDOL_ALTARS: IdolAltarDef[] = RAW_ALTARS.map((altar) => {
  const grid = ALTAR_GRID_SHAPES[altar.subTypeId];
  const parsed = grid
    ? parseAltarGrid(grid)
    : { blocked: DEFAULT_BLOCKED_SLOTS, refracted: [] as number[] };
  return {
    id: `altar-41-${altar.subTypeId}`,
    name: altar.name,
    subTypeId: altar.subTypeId,
    layout: { rows: DEFAULT_IDOL_GRID.rows, cols: DEFAULT_IDOL_GRID.cols },
    slotIndices: DEFAULT_IDOL_SLOT_INDICES,
    blockedSlots: parsed.blocked,
    refractedSlots: parsed.refracted,
    effects: altar.effects.map(toEffect),
  };
});
