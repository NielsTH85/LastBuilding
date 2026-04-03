import { describe, it, expect } from "vitest";
import {
  createEmptyBuild,
  allocatePassive,
  addSkill,
  allocateSkillNode,
  equipItem,
  createEquippedItem,
} from "@eob/build-model";
import { computeSnapshot } from "@eob/calc-engine";
import { getGameData } from "@eob/game-data";
import { saveBuild, loadBuild } from "@eob/serialization";

const gameData = getGameData();

/**
 * Fixture 1: Empty Runemaster
 * Just base class stats, nothing allocated.
 * Mage base: INT=3, HP=100, Mana=50, health_regen=6, mana_regen=8,
 *            crit_chance=5, crit_multiplier=200
 */
function createEmptyRunemaster() {
  return createEmptyBuild("mage", "runemaster");
}

/**
 * Fixture 2: Basic caster Runemaster
 * - 5 pts Arcanist (mage-base:0): +5 INT, +15% fire res, +15% light res
 * - 3 pts Elementalist (mage-base:2): +21% inc fire/cold/lightning dmg
 * - 5 pts Arcane Focus (runemaster:86): +5 INT
 * - 1 pt Quintessence of Triumph (runemaster:54): +7% inc spell dmg, +7% more spell dmg
 * - Flame Ward skill with 3 pts Infusion (fw3d:2): +150% inc fire dmg
 */
function createBasicCaster() {
  let b = createEmptyBuild("mage", "runemaster");

  // Passives
  b = allocatePassive(b, "mage-base:0", 5); // Arcanist: +1 INT/pt
  b = allocatePassive(b, "mage-base:2", 3); // Elementalist: +7% inc fire/cold/lightning per pt
  b = allocatePassive(b, "runemaster:86", 5); // Arcane Focus: +1 INT/pt
  b = allocatePassive(b, "runemaster:54", 1); // Quintessence of Triumph: +7% inc spell dmg, +7% more spell dmg

  // Skills
  b = addSkill(b, "flameward");
  b = allocateSkillNode(b, "flameward", "fw3d:2", 3); // Infusion: +50% inc fire dmg per pt

  return b;
}

/**
 * Fixture 3: Geared Runemaster
 * All of basic caster plus:
 * - 5 pts Scholar (mage-base:1): +60 HP, +15 mana
 * - 3 pts Knowledge of Destruction (mage-base:9): +21% crit chance, +9% crit multi
 * - 5 pts Transcendence (runemaster:91): +60 HP, +60 ward/sec
 * - 3 pts Cerulean Runestones (runemaster:109): +6% endurance, +12 mana
 * - Keeper Helm (+28 armor, +6 mana), Initiate Robes (+26 armor, +13 mana)
 * - Leather Boots (+15 armor, +8% move speed)
 * - Added Health affix T2 (+20 health) on robes
 */
function createGearedRunemaster() {
  let b = createBasicCaster();

  // More passives
  b = allocatePassive(b, "mage-base:1", 5); // Scholar: +12 HP/pt, +3 mana/pt
  b = allocatePassive(b, "mage-base:9", 3); // Knowledge of Destruction: +7% crit/pt, +3% crit multi/pt
  b = allocatePassive(b, "runemaster:91", 5); // Transcendence: +12 HP/pt, +12 ward/sec/pt
  b = allocatePassive(b, "runemaster:109", 3); // Cerulean Runestones: +2% endurance/pt, +4 mana/pt

  // Equipment: real items from game data
  const robes = createEquippedItem("bodyArmor-1-10", "rare", [
    { affixId: "affix-25", tier: 2, value: 20 }, // Added Health T2
  ]);
  b = equipItem(b, "bodyArmor", robes);

  const helm = createEquippedItem("helmet-0-18"); // Keeper Helm: +28 armor, +6 mana
  b = equipItem(b, "helmet", helm);

  const boots = createEquippedItem("boots-3-1"); // Leather Boots: +15 armor, +8% move speed
  b = equipItem(b, "boots", boots);

  return b;
}

describe("Golden fixtures", () => {
  describe("Fixture 1: Empty Runemaster", () => {
    const build = createEmptyRunemaster();
    const snap = computeSnapshot(build, gameData);

    it("has correct base intelligence", () => {
      // Mage base INT = 3
      expect(snap.stats["intelligence"]).toBe(3);
    });

    it("has correct base health (100 + vitality*10 = 100 + 0 = 100)", () => {
      expect(snap.stats["health"]).toBe(100);
    });

    it("has correct base mana", () => {
      expect(snap.stats["mana"]).toBe(50);
    });

    it("has no ward retention", () => {
      expect(snap.stats["ward_retention"] ?? 0).toBe(0);
    });

    it("has correct crit chance", () => {
      expect(snap.stats["crit_chance"]).toBe(5);
    });

    it("has correct crit multiplier", () => {
      expect(snap.stats["crit_multiplier"]).toBe(200);
    });

    it("round-trips through serialization", () => {
      const json = saveBuild(build);
      const loaded = loadBuild(json);
      const snap2 = computeSnapshot(loaded, gameData);
      expect(snap2.stats).toEqual(snap.stats);
    });
  });

  describe("Fixture 2: Basic caster Runemaster", () => {
    const build = createBasicCaster();
    const snap = computeSnapshot(build, gameData);

    it("has boosted intelligence (3 base + 5 Arcanist + 5 Arcane Focus = 13)", () => {
      expect(snap.stats["intelligence"]).toBe(13);
    });

    it("has increased spell damage from passive", () => {
      // Quintessence of Triumph: 7
      expect(snap.stats["increased_spell_damage"]).toBe(7);
    });

    it("has increased fire damage from passives + skill", () => {
      // Elementalist 3pts: 21, Infusion 3pts: 150 = 171
      expect(snap.stats["increased_fire_damage"]).toBe(171);
    });

    it("has fire resistance from Arcanist", () => {
      // 5pts × 3% = 15%
      expect(snap.stats["fire_resistance"]).toBe(15);
    });

    it("has lightning resistance from Arcanist", () => {
      // 5pts × 3% = 15%
      expect(snap.stats["lightning_resistance"]).toBe(15);
    });

    it("has spell_damage zero (more multiplier on zero base)", () => {
      // Quintessence of Triumph grants 7% more spell damage, but no flat
      // spell_damage source → 0 × 1.07 = 0
      expect(snap.stats["spell_damage"]).toBe(0);
    });

    it("round-trips through serialization", () => {
      const json = saveBuild(build);
      const loaded = loadBuild(json);
      const snap2 = computeSnapshot(loaded, gameData);
      expect(snap2.stats).toEqual(snap.stats);
    });
  });

  describe("Fixture 3: Geared Runemaster", () => {
    const build = createGearedRunemaster();
    const snap = computeSnapshot(build, gameData);

    it("has correct intelligence", () => {
      // 3 base + 5 Arcanist + 5 Arcane Focus = 13
      expect(snap.stats["intelligence"]).toBe(13);
    });

    it("has boosted mana", () => {
      // 50 base + 15 Scholar + 12 Cerulean + 6 Keeper Helm + 13 Initiate Robes = 96
      expect(snap.stats["mana"]).toBe(96);
    });

    it("has crit chance from Knowledge of Destruction", () => {
      // 5 base + 21 (3pts × 7%) = 26
      expect(snap.stats["crit_chance"]).toBe(26);
    });

    it("has crit multiplier from Knowledge of Destruction", () => {
      // 200 base + 9 (3pts × 3%) = 209
      expect(snap.stats["crit_multiplier"]).toBe(209);
    });

    it("has armor from equipment", () => {
      // 28 Keeper Helm + 26 Initiate Robes + 15 Leather Boots = 69
      expect(snap.stats["armor"]).toBe(69);
    });

    it("has ward generation from Transcendence", () => {
      // 5pts × 12 = 60
      expect(snap.stats["ward_generation"]).toBe(60);
    });

    it("has increased movement speed from boots (percentage on zero base = 0)", () => {
      // Leather Boots: +8% increased movement speed, but no base movement speed → 0
      expect(snap.stats["movement_speed"] ?? 0).toBe(0);
    });

    it("has health from base + passives + affix", () => {
      // health = (100 + 60 Scholar + 60 Transcendence + 20 affix) = 240
      expect(snap.stats["health"]).toBe(240);
    });

    it("has inc spell damage from passive only", () => {
      // Quintessence: 7
      expect(snap.stats["increased_spell_damage"]).toBe(7);
    });

    it("has effective_health", () => {
      // health = 240, no ward. Effective health now includes defensive layers
      // (armor DR, etc.) so it exceeds raw health.
      expect(snap.stats["effective_health"]).toBeGreaterThan(240);
      expect(snap.stats["effective_health"]).toBeLessThan(300);
    });

    it("has endurance from Cerulean Runestones", () => {
      // 3pts × 2% = 6
      expect(snap.stats["endurance"]).toBe(6);
    });

    it("snapshot is deterministic", () => {
      const snap2 = computeSnapshot(build, gameData);
      expect(snap2.stats).toEqual(snap.stats);
      expect(snap2.offensive).toEqual(snap.offensive);
      expect(snap2.defensive).toEqual(snap.defensive);
    });

    it("round-trips through serialization", () => {
      const json = saveBuild(build);
      const loaded = loadBuild(json);
      const snap2 = computeSnapshot(loaded, gameData);
      expect(snap2.stats).toEqual(snap.stats);
    });
  });
});
