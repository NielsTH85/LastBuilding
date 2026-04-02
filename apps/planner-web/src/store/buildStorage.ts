import type { Build } from "@eob/build-model";
import { saveBuild, loadBuild } from "@eob/serialization";
import { getGameData } from "@eob/game-data";

const STORAGE_KEY = "eob-saved-builds";
const gameData = getGameData();

const LEGACY_AFFIX_ID_ALIASES: Record<string, string> = {
  "affix-785": "affix-698",
  "affix-805": "affix-720",
  "affix-820": "affix-735",
  "affix-1089": "affix-1070",
  "affix-1095": "affix-1078",
  "affix-1102": "affix-1085",
  "affix-1103": "affix-1086",
};

function migrateLoadedBuild(build: Build): Build {
  // Mutate the parsed object in-place before returning it.
  if (!build.extraModifiers) build.extraModifiers = [];

  for (const item of Object.values(build.equipment)) {
    if (!item) continue;
    for (const roll of item.affixes) {
      roll.affixId = LEGACY_AFFIX_ID_ALIASES[roll.affixId] ?? roll.affixId;

      const affixDef = gameData.affixes.find((a) => a.id === roll.affixId);
      const tierDef = affixDef?.tiers.find((t) => t.tier === roll.tier);
      // Legacy saves may store percentage-based tiers as fractions (e.g. 0.12 for 12%).
      if (tierDef && Math.abs(roll.value) <= 1 && Math.abs(tierDef.maxValue) <= 1) {
        roll.value *= 100;
      }
    }
  }

  return build;
}

export interface SavedBuildEntry {
  id: string;
  name: string;
  classId: string;
  masteryId?: string;
  updatedAt: number;
  json: string;
}

function generateId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function readEntries(): SavedBuildEntry[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as SavedBuildEntry[];
  } catch {
    return [];
  }
}

function writeEntries(entries: SavedBuildEntry[]): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
}

export function listSavedBuilds(): SavedBuildEntry[] {
  return readEntries().sort((a, b) => b.updatedAt - a.updatedAt);
}

export function saveBuildToStorage(build: Build, name: string, existingId?: string): string {
  const entries = readEntries();
  const json = saveBuild(build);
  const id = existingId ?? generateId();

  const idx = entries.findIndex((e) => e.id === id);
  const entry: SavedBuildEntry = {
    id,
    name,
    classId: build.character.classId,
    masteryId: build.character.masteryId,
    updatedAt: Date.now(),
    json,
  };

  if (idx >= 0) {
    entries[idx] = entry;
  } else {
    entries.push(entry);
  }

  writeEntries(entries);
  return id;
}

export function loadBuildFromStorage(id: string): Build {
  const entries = readEntries();
  const entry = entries.find((e) => e.id === id);
  if (!entry) throw new Error("Build not found");
  return migrateLoadedBuild(loadBuild(entry.json));
}

export function deleteBuildFromStorage(id: string): void {
  const entries = readEntries().filter((e) => e.id !== id);
  writeEntries(entries);
}
