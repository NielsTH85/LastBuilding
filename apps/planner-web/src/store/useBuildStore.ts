import { create } from "zustand";
import type { Build, BuildSnapshot, EquippedItem } from "@eob/build-model";
import {
  createEmptyBuild,
  allocatePassive,
  deallocatePassive,
  addSkill,
  removeSkill,
  allocateSkillNode,
  equipItem,
  unequipItem,
  createEquippedItem,
  cloneBuild,
} from "@eob/build-model";
import { computeSnapshot, computeDelta, type StatDelta } from "@eob/calc-engine";
import { getGameData, type ItemSlot, type ItemRarity } from "@eob/game-data";

const gameData = getGameData();
const IDOL_GRID_ROWS = gameData.idolGrid.rows;
const IDOL_GRID_COLS = gameData.idolGrid.cols;
const IDOL_GRID_CELLS = IDOL_GRID_ROWS * IDOL_GRID_COLS;

function getActiveAltar(build: Build) {
  const activeAltarId = build.idolAltarId ?? gameData.idolAltars[0]?.id;
  return gameData.idolAltars.find((a) => a.id === activeAltarId) ?? gameData.idolAltars[0];
}

function getImportedIdolSize(idolId: string): { width: number; height: number } | null {
  const match = idolId.match(/^idol-(\d+)-\d+$/);
  if (!match) return null;
  const baseType = Number(match[1]);
  if (baseType === 25 || baseType === 26) return { width: 1, height: 1 };
  if (baseType === 27) return { width: 2, height: 1 };
  if (baseType === 28) return { width: 1, height: 2 };
  if (baseType === 29) return { width: 3, height: 1 };
  if (baseType === 30) return { width: 1, height: 3 };
  if (baseType === 31) return { width: 4, height: 1 };
  if (baseType === 32) return { width: 1, height: 4 };
  if (baseType === 33) return { width: 2, height: 2 };
  return null;
}

function getIdolSize(idolId: string): { width: number; height: number } | null {
  const idol = gameData.idols.find((i) => i.id === idolId);
  if (idol) return idol.size;
  return getImportedIdolSize(idolId);
}

function getOccupiedIdolCells(slotIndex: number, width: number, height: number): number[] {
  const startRow = Math.floor(slotIndex / IDOL_GRID_COLS);
  const startCol = slotIndex % IDOL_GRID_COLS;
  const cells: number[] = [];
  for (let y = 0; y < height; y++) {
    const row = startRow + y;
    if (row >= IDOL_GRID_ROWS) return [];
    for (let x = 0; x < width; x++) {
      const col = startCol + x;
      if (col >= IDOL_GRID_COLS) return [];
      cells.push(row * IDOL_GRID_COLS + col);
    }
  }
  return cells;
}

function getIdolCellsFromState(
  state: { idolId: string; slotIndex?: number },
  fallbackIndex: number,
): number[] {
  const slotIndex = state.slotIndex ?? fallbackIndex;
  const size = getIdolSize(state.idolId);
  if (!size) return [];
  return getOccupiedIdolCells(slotIndex, size.width, size.height);
}

function recompute(build: Build, activeSkillId?: string | null): BuildSnapshot {
  return computeSnapshot(build, gameData, activeSkillId ?? undefined);
}

export interface BuildStore {
  build: Build;
  snapshot: BuildSnapshot;
  previewDelta: StatDelta[] | null;
  activeSkillId: string | null;
  inventory: Partial<Record<ItemSlot, EquippedItem[]>>;
  setActiveSkillId: (skillId: string | null) => void;
  setEnemyLevel: (enemyLevel: number) => void;
  setEnemyResistance: (damageType: string, resistance: number) => void;
  setIdolAltar: (idolAltarId: string | null) => void;
  setIdol: (slotIndex: number, idolId: string | null) => void;

  // Passives
  allocatePassive: (nodeId: string, points: number) => void;
  deallocatePassive: (nodeId: string) => void;

  // Skills
  addSkill: (skillId: string) => void;
  removeSkill: (skillId: string) => void;
  allocateSkillNode: (skillId: string, nodeId: string, points: number) => void;

  // Equipment
  equipItem: (slot: ItemSlot, baseId: string, rarity?: ItemRarity) => void;
  unequipItem: (slot: ItemSlot) => void;
  equipFullItem: (slot: ItemSlot, item: EquippedItem) => void;
  equipFromInventory: (slot: ItemSlot, index: number) => void;
  removeFromInventory: (slot: ItemSlot, index: number) => void;
  addAffix: (slot: ItemSlot, affixId: string, tier: number, value: number) => void;
  updateAffix: (slot: ItemSlot, affixId: string, tier: number, value: number) => void;
  removeAffix: (slot: ItemSlot, affixId: string) => void;

  // Preview
  previewPassive: (nodeId: string, points: number) => void;
  previewSkillNode: (skillId: string, nodeId: string, points: number) => void;
  previewEquip: (slot: ItemSlot, baseId: string) => void;
  previewUnequip: (slot: ItemSlot) => void;
  clearPreview: () => void;

  // Build management
  setBuild: (build: Build) => void;
  resetBuild: () => void;
}

const initialBuild = createEmptyBuild("mage", "runemaster");
const initialSnapshot = recompute(initialBuild);

export const useBuildStore = create<BuildStore>((set, get) => ({
  build: initialBuild,
  snapshot: initialSnapshot,
  previewDelta: null,
  activeSkillId: null,
  inventory: {},

  setActiveSkillId: (skillId) => {
    const { build } = get();
    set({ activeSkillId: skillId, snapshot: recompute(build, skillId) });
  },

  setEnemyLevel: (enemyLevel) => {
    const { build, activeSkillId } = get();
    const next = cloneBuild(build);
    next.config.enemyLevel = Math.max(1, Math.min(100, Math.round(enemyLevel)));
    set({ build: next, snapshot: recompute(next, activeSkillId), previewDelta: null });
  },

  setEnemyResistance: (damageType, resistance) => {
    const { build, activeSkillId } = get();
    const next = cloneBuild(build);
    const normalized = Math.max(-100, Math.min(100, Math.round(resistance)));
    next.config.enemyResistances = {
      ...(next.config.enemyResistances ?? {}),
      [damageType]: normalized,
    };
    set({ build: next, snapshot: recompute(next, activeSkillId), previewDelta: null });
  },

  setIdolAltar: (idolAltarId) => {
    const { build, activeSkillId } = get();
    const next = cloneBuild(build);
    next.idolAltarId = idolAltarId ?? undefined;
    set({ build: next, snapshot: recompute(next, activeSkillId), previewDelta: null });
  },

  setIdol: (slotIndex, idolId) => {
    const { build, activeSkillId } = get();
    const activeAltar = getActiveAltar(build);
    const allowedSlots = new Set(activeAltar?.slotIndices ?? []);
    const blockedSlots = new Set(activeAltar?.blockedSlots ?? []);

    if (slotIndex < 0 || slotIndex >= IDOL_GRID_CELLS) return;
    if (!allowedSlots.has(slotIndex) || blockedSlots.has(slotIndex)) return;

    const next = cloneBuild(build);
    const existingIndex = next.idols.findIndex((i, idx) => {
      const occupied = getIdolCellsFromState(i, idx);
      return occupied.includes(slotIndex);
    });

    if (!idolId) {
      if (existingIndex >= 0) next.idols.splice(existingIndex, 1);
    } else {
      const idol = gameData.idols.find((i) => i.id === idolId);
      if (!idol) return;

      const placementCells = getOccupiedIdolCells(slotIndex, idol.size.width, idol.size.height);
      if (placementCells.length === 0) return;
      if (placementCells.some((cell) => !allowedSlots.has(cell) || blockedSlots.has(cell))) return;

      const collidingIndexes = new Set<number>();
      for (const [idx, equipped] of next.idols.entries()) {
        const cells = getIdolCellsFromState(equipped, idx);
        if (cells.some((cell) => placementCells.includes(cell))) {
          collidingIndexes.add(idx);
        }
      }

      next.idols = next.idols.filter((_, idx) => !collidingIndexes.has(idx));
      next.idols.push({ idolId, slotIndex });
    }

    set({ build: next, snapshot: recompute(next, activeSkillId), previewDelta: null });
  },

  allocatePassive: (nodeId, points) => {
    const next = allocatePassive(get().build, nodeId, points);
    set({ build: next, snapshot: recompute(next, get().activeSkillId), previewDelta: null });
  },

  deallocatePassive: (nodeId) => {
    const next = deallocatePassive(get().build, nodeId);
    set({ build: next, snapshot: recompute(next, get().activeSkillId), previewDelta: null });
  },

  addSkill: (skillId) => {
    const next = addSkill(get().build, skillId);
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  removeSkill: (skillId) => {
    const next = removeSkill(get().build, skillId);
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  allocateSkillNode: (skillId, nodeId, points) => {
    const next = allocateSkillNode(get().build, skillId, nodeId, points);
    set({ build: next, snapshot: recompute(next, get().activeSkillId), previewDelta: null });
  },

  equipItem: (slot, baseId, rarity = "normal") => {
    const item = createEquippedItem(baseId, rarity);
    const next = equipItem(get().build, slot, item);
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  unequipItem: (slot) => {
    const next = unequipItem(get().build, slot);
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  equipFullItem: (slot, item) => {
    const { build, activeSkillId, inventory } = get();
    const next = cloneBuild(build);
    const newInv = { ...inventory };
    const current = next.equipment[slot];
    if (current) {
      newInv[slot] = [...(newInv[slot] ?? []), current];
    }
    next.equipment[slot] = item;
    set({
      build: next,
      snapshot: recompute(next, activeSkillId),
      inventory: newInv,
      previewDelta: null,
    });
  },

  equipFromInventory: (slot, index) => {
    const { build, activeSkillId, inventory } = get();
    const items = inventory[slot];
    if (!items || !items[index]) return;
    const next = cloneBuild(build);
    const newInv = { ...inventory };
    const invItems = [...(newInv[slot] ?? [])];
    const current = next.equipment[slot];
    const invItem = invItems.splice(index, 1)[0];
    if (current) invItems.push(current);
    next.equipment[slot] = invItem;
    newInv[slot] = invItems;
    set({
      build: next,
      snapshot: recompute(next, activeSkillId),
      inventory: newInv,
      previewDelta: null,
    });
  },

  removeFromInventory: (slot, index) => {
    const { inventory } = get();
    const items = inventory[slot];
    if (!items) return;
    const newInv = { ...inventory };
    const invItems = [...items];
    invItems.splice(index, 1);
    newInv[slot] = invItems;
    set({ inventory: newInv });
  },

  addAffix: (slot, affixId, tier, value) => {
    const { build } = get();
    const next = cloneBuild(build);
    const item = next.equipment[slot];
    if (!item) return;
    item.affixes.push({ affixId, tier, value });
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  updateAffix: (slot, affixId, tier, value) => {
    const { build } = get();
    const next = cloneBuild(build);
    const item = next.equipment[slot];
    if (!item) return;
    const affix = item.affixes.find((a) => a.affixId === affixId);
    if (!affix) return;
    affix.tier = tier;
    affix.value = value;
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  removeAffix: (slot, affixId) => {
    const { build } = get();
    const next = cloneBuild(build);
    const item = next.equipment[slot];
    if (!item) return;
    item.affixes = item.affixes.filter((a) => a.affixId !== affixId);
    set({ build: next, snapshot: recompute(next, get().activeSkillId) });
  },

  previewPassive: (nodeId, points) => {
    const { build, snapshot, activeSkillId } = get();
    const candidate = allocatePassive(build, nodeId, points);
    const candidateSnap = recompute(candidate, activeSkillId);
    set({ previewDelta: computeDelta(snapshot, candidateSnap) });
  },

  previewSkillNode: (skillId, nodeId, points) => {
    const { build, snapshot, activeSkillId } = get();
    const candidate = allocateSkillNode(build, skillId, nodeId, points);
    const candidateSnap = recompute(candidate, activeSkillId);
    set({ previewDelta: computeDelta(snapshot, candidateSnap) });
  },

  previewEquip: (slot, baseId) => {
    const { build, snapshot, activeSkillId } = get();
    const item = createEquippedItem(baseId);
    const candidate = equipItem(build, slot, item);
    const candidateSnap = recompute(candidate, activeSkillId);
    set({ previewDelta: computeDelta(snapshot, candidateSnap) });
  },

  previewUnequip: (slot) => {
    const { build, snapshot, activeSkillId } = get();
    const candidate = unequipItem(build, slot);
    const candidateSnap = recompute(candidate, activeSkillId);
    set({ previewDelta: computeDelta(snapshot, candidateSnap) });
  },

  clearPreview: () => set({ previewDelta: null }),

  setBuild: (build) =>
    set({ build, snapshot: recompute(build, get().activeSkillId), previewDelta: null }),

  resetBuild: () => {
    const { build } = get();
    const fresh = createEmptyBuild(build.character.classId, build.character.masteryId);
    set({ build: fresh, snapshot: recompute(fresh), previewDelta: null, activeSkillId: null });
  },
}));
