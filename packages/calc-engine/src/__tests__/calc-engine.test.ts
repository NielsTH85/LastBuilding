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
    // Mage base intelligence = 3
    const total = intMods.reduce((sum, m) => sum + m.value, 0);
    expect(total).toBe(3);
  });

  it("collects passive modifiers scaled by points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Arcanist: +1 INT per point, max 8
    build = allocatePassive(build, "mage-base:0", 3);
    const mods = collectModifiers(build, gameData);
    const passiveMod = mods.find((m) => m.id === "mage-base:0-intelligence-x3");
    expect(passiveMod).toBeDefined();
    expect(passiveMod!.value).toBe(3); // 1 * 3
  });

  it("collects item implicit modifiers", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Refuge Helmet: +14 armor
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const mods = collectModifiers(build, gameData);
    const impl = mods.find((m) => m.id === "helmet-0-0-impl-armor");
    expect(impl).toBeDefined();
    expect(impl!.value).toBe(14);
  });

  it("collects item affix modifiers", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Refuge Armor with Added Health affix T2 (value=20)
    build = equipItem(
      build,
      "bodyArmor",
      createEquippedItem("bodyArmor-1-0", "rare", [
        { affixId: "affix-25", tier: 2, value: 20 },
      ]),
    );
    const mods = collectModifiers(build, gameData);
    const affixMod = mods.find((m) => m.id === "affix-25-t2");
    expect(affixMod).toBeDefined();
    expect(affixMod!.value).toBe(20);
  });

  it("retains all imported normal affixes", () => {
    // Guard against silently dropping affixes due to unmapped stat IDs.
    expect(gameData.affixes.length).toBe(448);
  });

  it("collects secondary modifiers for multi-property affixes", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Affix 29 has a secondary roll range in extraRolls.
    // Tier 1 primary: 12-17, set roll to midpoint 14.5 -> ratio 0.5
    // Tier 1 secondary: 40-65 -> expected 52.5
    build = equipItem(
      build,
      "bodyArmor",
      createEquippedItem("bodyArmor-1-0", "rare", [
        { affixId: "affix-29", tier: 1, value: 14.5 },
      ]),
    );

    const mods = collectModifiers(build, gameData);
    const primary = mods.find((m) => m.id === "affix-29-t1");
    const secondary = mods.find((m) => m.id === "affix-29-t1-x1");

    expect(primary).toBeDefined();
    expect(primary!.value).toBe(14.5);
    expect(secondary).toBeDefined();
    expect(secondary!.value).toBeCloseTo(52.5, 5);
  });

  it("collects skill node modifiers scaled by points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Flame Ward → Infusion (fw3d:2): +50% Increased Fire Damage per point
    build = addSkill(build, "flameward");
    build = allocateSkillNode(build, "flameward", "fw3d:2", 3);
    const mods = collectModifiers(build, gameData);
    const skillMod = mods.find((m) => m.id === "fw3d:2-increased-fire-damage-x3");
    expect(skillMod).toBeDefined();
    expect(skillMod!.value).toBe(150); // 50 * 3
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
    // Mage base intelligence = 3 (no mastery bonus)
    expect(snapshot.stats["intelligence"]).toBe(3);
  });

  it("includes health derived from vitality", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snapshot = computeSnapshot(build, gameData);
    // Mage base health=100, vitality=0 → health = 100 + 0*10 = 100
    expect(snapshot.stats["health"]).toBe(100);
    expect(snapshot.defensive.health).toBe(100);
  });

  it("passive allocation changes stats", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);
    // Arcanist: +1 INT per point, allocate 5
    build = allocatePassive(build, "mage-base:0", 5);
    const after = computeSnapshot(build, gameData);

    // Intelligence should increase by 5 (1 * 5)
    expect(after.stats["intelligence"]! - before.stats["intelligence"]!).toBe(5);
  });

  it("equipping an item adds implicits to stats", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);
    // Refuge Helmet: +14 armor
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const after = computeSnapshot(build, gameData);

    expect(
      (after.stats["armor"] ?? 0) -
      (before.stats["armor"] ?? 0)
    ).toBe(14);
  });

  it("more multiplier applies to spell damage", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Celestial Doom (runemaster:101): +1 flat spell damage per point
    build = allocatePassive(build, "runemaster:101", 5);
    // Quintessence of Triumph (runemaster:54): +7% more spell damage per point
    build = allocatePassive(build, "runemaster:54", 2);

    const snapshot = computeSnapshot(build, gameData);
    const spellDmgBreakdown = snapshot.breakdowns.find((b) => b.statId === "spell_damage");
    expect(spellDmgBreakdown).toBeDefined();
    // 5 flat spell damage * (1 + 14/100) = 5 * 1.14 = 5.7
    expect(spellDmgBreakdown!.added).toBe(5);
    expect(spellDmgBreakdown!.more).toBeCloseTo(14);
    expect(spellDmgBreakdown!.final).toBeCloseTo(5.7);
  });

  it("uses active skill baseline for expected DPS", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = addSkill(build, "lightningblast");

    const noSkillSnapshot = computeSnapshot(build, gameData);
    const activeSkillSnapshot = computeSnapshot(build, gameData, "lightningblast");

    expect(activeSkillSnapshot.offensive.averageHit).toBeCloseTo(24.696, 3);
    expect(activeSkillSnapshot.offensive.expectedDps).toBeCloseTo(97.925, 3);
    expect(activeSkillSnapshot.offensive.expectedDps).toBeLessThan(noSkillSnapshot.offensive.expectedDps);
  });
});

describe("computeDelta", () => {
  it("diffs two snapshots correctly", () => {
    let build = createEmptyBuild("mage", "runemaster");
    const before = computeSnapshot(build, gameData);

    // Arcanist: +1 INT per point, allocate 5
    build = allocatePassive(build, "mage-base:0", 5);
    const after = computeSnapshot(build, gameData);

    const deltas = computeDelta(before, after);
    const intDelta = deltas.find((d) => d.statId === "intelligence");
    expect(intDelta).toBeDefined();
    expect(intDelta!.diff).toBe(5);
    expect(intDelta!.before).toBe(3);
    expect(intDelta!.after).toBe(8);
  });

  it("returns empty array for identical snapshots", () => {
    const build = createEmptyBuild("mage", "runemaster");
    const snap = computeSnapshot(build, gameData);
    const deltas = computeDelta(snap, snap);
    expect(deltas.length).toBe(0);
  });

  it("handles item swap deltas", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Refuge Helmet: +14 armor
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const before = computeSnapshot(build, gameData);

    // Swap to Copper Circlet: +8 armor
    let build2 = cloneBuild(build);
    build2 = equipItem(build2, "helmet", createEquippedItem("helmet-0-16"));
    const after = computeSnapshot(build2, gameData);

    const deltas = computeDelta(before, after);
    // Should have armor change (14 → 8)
    expect(deltas.length).toBeGreaterThan(0);
    const armorDelta = deltas.find((d) => d.statId === "armor");
    expect(armorDelta).toBeDefined();
    expect(armorDelta!.diff).toBe(-6);
  });
});
