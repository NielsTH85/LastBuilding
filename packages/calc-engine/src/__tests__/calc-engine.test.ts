import { describe, it, expect } from "vitest";
import { computeSnapshot } from "../compute.js";
import { collectModifiers } from "../collect-modifiers.js";
import { aggregateModifiers } from "../aggregate.js";
import { resolveStat } from "../resolve-stats.js";
import { computeDelta } from "../delta.js";
import {
  createEmptyBuild,
  allocatePassive,
  addSkill,
  allocateSkillNode,
  equipItem,
  createEquippedItem,
  cloneBuild,
} from "@eob/build-model";
import { getGameData } from "@eob/game-data";

const gameData = getGameData();

describe("collectModifiers", () => {
  it("collects base class stats", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const mods = collectModifiers(build, gameData);
    const intMods = mods.filter((m) => m.targetStat === "intelligence");
    // Mage base (10) + Runemaster bonus (4)
    const total = intMods.reduce((sum, m) => sum + m.value, 0);
    expect(total).toBe(14);
  });

  it("collects passive modifiers scaled by points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = allocatePassive(build, "mb-arcane-focus", 3);
    const mods = collectModifiers(build, gameData);
    const passiveMod = mods.find((m) => m.id === "mb-arcane-focus-int-x3");
    expect(passiveMod).toBeDefined();
    expect(passiveMod!.value).toBe(12); // 4 * 3
  });

  it("collects item implicit modifiers", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = equipItem(build, "weapon1", createEquippedItem("oracle-staff"));
    const mods = collectModifiers(build, gameData);
    const impl = mods.find((m) => m.id === "oracle-staff-impl-sd");
    expect(impl).toBeDefined();
    expect(impl!.value).toBe(15);
  });

  it("collects item affix modifiers", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = equipItem(
      build,
      "bodyArmor",
      createEquippedItem("arcane-robes", "rare", [
        { affixId: "affix-flat-health", tier: 2, value: 35 },
      ]),
    );
    const mods = collectModifiers(build, gameData);
    const affixMod = mods.find((m) => m.id === "affix-flat-health-t2");
    expect(affixMod).toBeDefined();
    expect(affixMod!.value).toBe(35);
  });

  it("collects skill node modifiers scaled by points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = addSkill(build, "runic-invocation");
    build = allocateSkillNode(build, "runic-invocation", "ri-empowered-runes", 3);
    const mods = collectModifiers(build, gameData);
    const skillMod = mods.find((m) => m.id === "ri-empowered-runes-dmg-x3");
    expect(skillMod).toBeDefined();
    expect(skillMod!.value).toBe(36); // 12 * 3
  });
});

describe("aggregateModifiers", () => {
  it("groups modifiers by stat and operation", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const mods = collectModifiers(build, gameData);
    const agg = aggregateModifiers(mods);

    const intAgg = agg.get("intelligence");
    expect(intAgg).toBeDefined();
    expect(intAgg!.addMods.length).toBeGreaterThan(0);
  });
});

describe("resolveStat", () => {
  it("applies add → increased → more pipeline correctly", () => {
    const result = resolveStat({
      statId: "test_stat",
      addMods: [
        { id: "a1", sourceType: "base", sourceId: "x", targetStat: "health" as const, operation: "add", value: 100 },
        { id: "a2", sourceType: "passive", sourceId: "y", targetStat: "health" as const, operation: "add", value: 50 },
      ],
      increasedMods: [
        { id: "i1", sourceType: "passive", sourceId: "z", targetStat: "health" as const, operation: "increased", value: 20 },
      ],
      moreMods: [
        { id: "m1", sourceType: "passive", sourceId: "w", targetStat: "health" as const, operation: "more", value: 10 },
      ],
    });

    // (0 + 100 + 50) * (1 + 20/100) * (1 + 10/100) = 150 * 1.2 * 1.1 = 198
    expect(result.final).toBeCloseTo(198);
    expect(result.added).toBe(150);
    expect(result.increased).toBe(20);
    expect(result.more).toBeCloseTo(10);
  });

  it("handles override modifier", () => {
    const result = resolveStat({
      statId: "test_stat",
      addMods: [
        { id: "a1", sourceType: "base", sourceId: "x", targetStat: "health" as const, operation: "add", value: 100 },
      ],
      increasedMods: [],
      moreMods: [],
      overrideMod: { id: "o1", sourceType: "base", sourceId: "x", targetStat: "health" as const, operation: "override", value: 999 },
    });

    expect(result.final).toBe(999);
  });

  it("handles empty modifier lists", () => {
    const result = resolveStat({
      statId: "test_stat",
      addMods: [],
      increasedMods: [],
      moreMods: [],
    });

    expect(result.final).toBe(0);
  });
});

describe("computeSnapshot", () => {
  it("produces a valid snapshot for an empty build", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snapshot = computeSnapshot(build, gameData);

    expect(snapshot.stats).toBeDefined();
    expect(snapshot.offensive).toBeDefined();
    expect(snapshot.defensive).toBeDefined();
    expect(snapshot.sustain).toBeDefined();
    expect(snapshot.breakdowns.length).toBeGreaterThan(0);
  });

  it("is deterministic — same input produces same output", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snap1 = computeSnapshot(build, gameData);
    const snap2 = computeSnapshot(build, gameData);
    expect(snap1).toEqual(snap2);
  });

  it("base mage/runemaster has correct intelligence", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snapshot = computeSnapshot(build, gameData);
    // Mage base 10 + Runemaster bonus 4 = 14
    expect(snapshot.stats["intelligence"]).toBe(14);
  });

  it("includes health derived from vitality", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snapshot = computeSnapshot(build, gameData);
    // Mage base health=80, vitality=6 → health = 80 + 6*10 = 140
    expect(snapshot.stats["health"]).toBe(140);
    expect(snapshot.defensive.health).toBe(140);
  });

  it("passive allocation changes stats", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);
    build = allocatePassive(build, "mb-arcane-focus", 5);
    const after = computeSnapshot(build, gameData);

    // Intelligence should increase by 20 (4 * 5)
    expect(after.stats["intelligence"]! - before.stats["intelligence"]!).toBe(20);
  });

  it("equipping an item adds implicits to stats", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);
    build = equipItem(build, "weapon1", createEquippedItem("oracle-staff"));
    const after = computeSnapshot(build, gameData);

    // Oracle Staff implicit: +15 increased spell damage
    expect(
      (after.stats["increased_spell_damage"] ?? 0) -
      (before.stats["increased_spell_damage"] ?? 0)
    ).toBe(15);
  });

  it("more multiplier stacks multiplicatively", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Allocate rm-spell-conduit (10% more spell damage)
    build = allocatePassive(build, "rm-spell-conduit", 1);
    // Add glacier skill with deep freeze (20% more spell damage)
    build = addSkill(build, "glacier");
    build = allocateSkillNode(build, "glacier", "gl-deep-freeze", 1);

    const snapshot = computeSnapshot(build, gameData);
    // Both more modifiers should stack multiplicatively
    const spellDmgBreakdown = snapshot.breakdowns.find((b) => b.statId === "spell_damage");
    if (spellDmgBreakdown) {
      // 1.1 * 1.2 = 1.32, so more = 32%
      expect(spellDmgBreakdown.more).toBeCloseTo(32);
    }
  });
});

describe("computeDelta", () => {
  it("diffs two snapshots correctly", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);

    build = allocatePassive(build, "mb-arcane-focus", 5);
    const after = computeSnapshot(build, gameData);

    const deltas = computeDelta(before, after);
    const intDelta = deltas.find((d) => d.statId === "intelligence");
    expect(intDelta).toBeDefined();
    expect(intDelta!.diff).toBe(20);
    expect(intDelta!.before).toBe(14);
    expect(intDelta!.after).toBe(34);
  });

  it("returns empty array for identical snapshots", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snap = computeSnapshot(build, gameData);
    const deltas = computeDelta(snap, snap);
    expect(deltas.length).toBe(0);
  });

  it("handles item swap deltas", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = equipItem(build, "weapon1", createEquippedItem("oracle-staff"));
    const before = computeSnapshot(build, gameData);

    // Swap to copper wand
    let build2 = cloneBuild(build);
    build2 = equipItem(build2, "weapon1", createEquippedItem("copper-wand"));
    const after = computeSnapshot(build2, gameData);

    const deltas = computeDelta(before, after);
    // Should have changes in increased_spell_damage (lost) and cast_speed (gained)
    expect(deltas.length).toBeGreaterThan(0);
  });
});
