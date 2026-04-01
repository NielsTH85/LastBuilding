import type { Modifier } from "@eob/game-data";

export interface AggregatedStat {
  statId: string;
  addMods: Modifier[];
  increasedMods: Modifier[];
  moreMods: Modifier[];
  setMod?: Modifier;
  overrideMod?: Modifier;
}

/**
 * Group modifiers by target stat and operation type.
 */
export function aggregateModifiers(modifiers: Modifier[]): Map<string, AggregatedStat> {
  const map = new Map<string, AggregatedStat>();

  for (const mod of modifiers) {
    let entry = map.get(mod.targetStat);
    if (!entry) {
      entry = {
        statId: mod.targetStat,
        addMods: [],
        increasedMods: [],
        moreMods: [],
      };
      map.set(mod.targetStat, entry);
    }

    switch (mod.operation) {
      case "add":
        entry.addMods.push(mod);
        break;
      case "increased":
        entry.increasedMods.push(mod);
        break;
      case "more":
        entry.moreMods.push(mod);
        break;
      case "set":
        entry.setMod = mod;
        break;
      case "override":
        entry.overrideMod = mod;
        break;
    }
  }

  return map;
}
