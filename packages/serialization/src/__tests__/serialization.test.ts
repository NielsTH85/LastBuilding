import { describe, it, expect } from "vitest";
import { saveBuild, loadBuild } from "../save-load.js";
import { createEmptyBuild, allocatePassive, equipItem, createEquippedItem } from "@eob/build-model";

describe("saveBuild / loadBuild", () => {
  it("round-trips an empty build", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const json = saveBuild(build);
    const loaded = loadBuild(json);
    expect(loaded.character.classId).toBe("mage");
    expect(loaded.character.masteryId).toBe("runemaster");
    expect(loaded.passives).toEqual([]);
    expect(loaded.skills).toEqual([]);
    expect(loaded.version).toBe("0.1.0");
  });

  it("round-trips a build with passives and items", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = allocatePassive(build, "mb-arcane-focus", 5);
    build = equipItem(build, "weapon1", createEquippedItem("oracle-staff", "rare", [
      { affixId: "affix-inc-spell-damage", tier: 2, value: 25 },
    ]));

    const json = saveBuild(build);
    const loaded = loadBuild(json);

    expect(loaded.passives).toHaveLength(1);
    expect(loaded.passives[0]!.nodeId).toBe("mb-arcane-focus");
    expect(loaded.passives[0]!.points).toBe(5);
    expect(loaded.equipment.weapon1).toBeDefined();
    expect(loaded.equipment.weapon1!.affixes).toHaveLength(1);
  });

  it("throws on invalid JSON", () => {
    expect(() => loadBuild("not json")).toThrow();
  });

  it("throws on missing version", () => {
    expect(() => loadBuild(JSON.stringify({ character: {} }))).toThrow("missing version");
  });

  it("throws on missing character", () => {
    expect(() => loadBuild(JSON.stringify({ version: "0.1.0" }))).toThrow("missing character");
  });
});
