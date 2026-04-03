import { describe, it, expect } from "vitest";
import { computeSnapshot } from "../compute.js";
import { collectModifiers } from "../collect-modifiers.js";
import { aggregateModifiers } from "../aggregate.js";
import { resolveStat } from "../resolve-stats.js";
import { computeDelta } from "../delta.js";
import { computeDerivedStats } from "../derived.js";
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
      createEquippedItem("bodyArmor-1-0", "rare", [{ affixId: "affix-25", tier: 2, value: 20 }]),
    );
    const mods = collectModifiers(build, gameData);
    const affixMod = mods.find((m) => m.id === "affix-25-t2");
    expect(affixMod).toBeDefined();
    expect(affixMod!.value).toBe(20);
  });

  it("retains all imported normal affixes", () => {
    // Guard against silently dropping affixes due to unmapped stat IDs.
    expect(gameData.affixes.length).toBe(771);
  });

  it("collects secondary modifiers for multi-property affixes", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Affix 29 has a secondary roll range in extraRolls.
    // Tier 1 primary: 12-17, set roll to midpoint 14.5 -> ratio 0.5
    // Tier 1 secondary: 40-65 -> expected 52.5
    build = equipItem(
      build,
      "bodyArmor",
      createEquippedItem("bodyArmor-1-0", "rare", [{ affixId: "affix-29", tier: 1, value: 14.5 }]),
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

  it("enforces weaver idol cap from altar property 5", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.idolAltarId = "altar-41-1"; // Jagged Altar: max 2 weaver idols
    build.idols = [
      {
        idolId: "idol-25-2",
        slotIndex: 1,
        affixes: [{ affixId: "affix-25", tier: 1, value: 15 }],
      },
      {
        idolId: "idol-26-1",
        slotIndex: 2,
        affixes: [{ affixId: "affix-25", tier: 1, value: 16 }],
      },
      {
        idolId: "idol-27-1",
        slotIndex: 3,
        affixes: [{ affixId: "affix-25", tier: 1, value: 17 }],
      },
    ];

    const mods = collectModifiers(build, gameData);
    const idolAffixMods = mods.filter((m) => m.sourceType === "idol" && m.id.includes("affix-25-t1"));

    // Third weaver idol is above cap and should not contribute its affix modifier.
    expect(idolAffixMods.length).toBe(2);
    expect(idolAffixMods.some((m) => m.id.startsWith("idol-27-1-affix-25-t1"))).toBe(false);
  });

  it("enforces adorned idol cap from altar property 7", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.idolAltarId = "altar-41-7"; // Ocular Altar: max 2 adorned idols
    build.idols = [
      {
        idolId: "idol-33-0",
        slotIndex: 0,
        affixes: [{ affixId: "affix-25", tier: 1, value: 15 }],
      },
      {
        idolId: "idol-33-1",
        slotIndex: 4,
        affixes: [{ affixId: "affix-25", tier: 1, value: 16 }],
      },
      {
        idolId: "idol-33-2",
        slotIndex: 20,
        affixes: [{ affixId: "affix-25", tier: 1, value: 17 }],
      },
    ];

    const mods = collectModifiers(build, gameData);
    const idolAffixMods = mods.filter((m) => m.sourceType === "idol" && m.id.includes("affix-25-t1"));

    expect(idolAffixMods.length).toBe(2);
    expect(idolAffixMods.some((m) => m.id.startsWith("idol-33-2-affix-25-t1"))).toBe(false);
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
        {
          id: "a1",
          sourceType: "base",
          sourceId: "x",
          targetStat: "health" as const,
          operation: "add",
          value: 100,
        },
        {
          id: "a2",
          sourceType: "passive",
          sourceId: "y",
          targetStat: "health" as const,
          operation: "add",
          value: 50,
        },
      ],
      increasedMods: [
        {
          id: "i1",
          sourceType: "passive",
          sourceId: "z",
          targetStat: "health" as const,
          operation: "increased",
          value: 20,
        },
      ],
      moreMods: [
        {
          id: "m1",
          sourceType: "passive",
          sourceId: "w",
          targetStat: "health" as const,
          operation: "more",
          value: 10,
        },
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
        {
          id: "a1",
          sourceType: "base",
          sourceId: "x",
          targetStat: "health" as const,
          operation: "add",
          value: 100,
        },
      ],
      increasedMods: [],
      moreMods: [],
      overrideMod: {
        id: "o1",
        sourceType: "base",
        sourceId: "x",
        targetStat: "health" as const,
        operation: "override",
        value: 999,
      },
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

    expect((after.stats["armor"] ?? 0) - (before.stats["armor"] ?? 0)).toBe(14);
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
    expect(activeSkillSnapshot.offensive.expectedDps).toBeLessThan(
      noSkillSnapshot.offensive.expectedDps,
    );
  });

  it("computes steady-state ailment DPS from stack and duration mechanics", () => {
    const stats = new Map();
    const setStat = (id: string, final: number) => {
      stats.set(id, { statId: id, base: 0, added: 0, increased: 0, more: 0, final });
    };

    setStat("cannot_chain", 1);
    setStat("ailment_chance", 0);
    setStat("poison_chance", 250);
    setStat("damage_over_time", 50);
    setStat("increased_poison_damage", 100);
    setStat("poison_duration", 0);

    computeDerivedStats(stats, {
      activeSkillId: "test-skill",
      activeSkillBaseline: {
        speedType: "cast",
        baseHitsPerSecond: 2,
        baseDamage: 0,
        addedDamageEffectiveness: 1,
      },
    });

    // Stacks/s = 2 uses × 1 hit × (250/100) = 5
    // Steady stacks = 5 × 3s = 15
    // Per-stack DPS = 20 × (1 + (100 + 50)/100) = 50
    // Total poison DPS = 15 × 50 = 750
    expect(stats.get("poison_dps_estimate")?.final).toBeCloseTo(750, 6);
  });

  it("applies throwing damage scaling only for throwing-tagged active skills", () => {
    const createStats = () => {
      const stats = new Map();
      const setStat = (id: string, final: number) => {
        stats.set(id, { statId: id, base: 0, added: 0, increased: 0, more: 0, final });
      };

      setStat("damage", 0);
      setStat("spell_damage", 100);
      setStat("melee_damage", 100);
      setStat("throwing_damage", 200);
      setStat("increased_damage", 0);
      setStat("increased_spell_damage", 100);
      setStat("increased_melee_damage", 100);
      setStat("increased_throwing_damage", 100);
      setStat("increased_physical_damage", 50);
      setStat("crit_multiplier", 200);
      setStat("crit_chance", 0);
      setStat("base_crit_chance", 0);
      setStat("cannot_chain", 1);
      return stats;
    };

    const castStats = createStats();
    computeDerivedStats(castStats, {
      activeSkillId: "test-cast-skill",
      activeSkillTags: ["spell"],
      activeSkillBaseline: {
        speedType: "cast",
        baseHitsPerSecond: 1,
        baseDamage: 0,
        addedDamageEffectiveness: 1,
      },
    });

    const throwingStats = createStats();
    computeDerivedStats(throwingStats, {
      activeSkillId: "test-throwing-skill",
      activeSkillTags: ["attack", "throwing"],
      activeSkillBaseline: {
        speedType: "attack",
        baseHitsPerSecond: 1,
        baseDamage: 0,
        addedDamageEffectiveness: 1,
      },
    });

    const castAverageHit = castStats.get("average_hit")?.final ?? 0;
    const throwingAverageHit = throwingStats.get("average_hit")?.final ?? 0;

    // Throwing-tagged skills should receive throwing scaling and not spell scaling.
    expect(throwingAverageHit).toBeGreaterThan(castAverageHit);
  });

  it("applies area scaling only for area-tagged active skills with nearby target cap", () => {
    const createStats = () => {
      const stats = new Map();
      const setStat = (id: string, final: number) => {
        stats.set(id, { statId: id, base: 0, added: 0, increased: 0, more: 0, final });
      };

      setStat("average_hit", 100);
      setStat("area", 150);
      setStat("increased_area", 0);
      setStat("attack_speed", 0);
      setStat("cast_speed", 0);
      setStat("crit_multiplier", 200);
      setStat("crit_chance", 0);
      setStat("base_crit_chance", 0);
      setStat("cannot_chain", 1);
      return stats;
    };

    const nonAreaStats = createStats();
    computeDerivedStats(nonAreaStats, {
      activeSkillId: "test-non-area",
      activeSkillTags: ["spell"],
      activeSkillBaseline: {
        speedType: "cast",
        baseHitsPerSecond: 1,
        baseDamage: 0,
        addedDamageEffectiveness: 1,
      },
      simulationConfig: { enemyLevel: 100, enemyNearbyCount: 5 },
    });

    const areaStats = createStats();
    computeDerivedStats(areaStats, {
      activeSkillId: "test-area",
      activeSkillTags: ["spell", "area"],
      activeSkillBaseline: {
        speedType: "cast",
        baseHitsPerSecond: 1,
        baseDamage: 0,
        addedDamageEffectiveness: 1,
      },
      simulationConfig: { enemyLevel: 100, enemyNearbyCount: 2 },
    });

    expect(nonAreaStats.get("dps_factor_area")?.final).toBeCloseTo(1, 6);
    // 150% increased area => area multiplier 2.5, capped by 2 nearby enemies.
    expect(areaStats.get("dps_factor_area")?.final).toBeCloseTo(2, 6);
  });

  it("computes deterministic minion hit and dps from minion stats", () => {
    const stats = new Map();
    const setStat = (id: string, final: number) => {
      stats.set(id, { statId: id, base: 0, added: 0, increased: 0, more: 0, final });
    };

    setStat("minion_damage", 100);
    setStat("increased_minion_damage", 100);
    setStat("minion_attack_speed", 50);
    setStat("minion_crit_chance", 100);
    setStat("minion_crit_multiplier", 50);

    computeDerivedStats(stats, {
      simulationConfig: {
        enemyLevel: 0,
        playerMinionCount: 2,
      },
    });

    // Per-minion hit:
    // base 100, increased +100% => 200
    // crit: (5 + 100)% capped to 100%, multiplier 250% => x2.5 => 500
    expect(stats.get("minion_average_hit_estimate")?.final).toBeCloseTo(500, 6);

    // DPS:
    // 2 minions * 500 * (1 + 50% speed) = 1500, with neutral enemy factors at level 0.
    expect(stats.get("minion_dps_estimate")?.final).toBeCloseTo(1500, 6);
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

// ── Condition evaluation tests ─────────────────────────

describe("condition evaluation", () => {
  it("filters out toggle-conditioned modifiers when toggle is inactive", () => {
    const build = createEmptyBuild("mage", "runemaster");
    // Add a custom modifier with a toggle condition
    build.extraModifiers = [
      {
        id: "toggle-test",
        sourceType: "buff",
        sourceId: "test",
        targetStat: "increased_damage",
        operation: "add",
        value: 50,
        conditions: [{ type: "toggle", value: "test_toggle" }],
      },
    ];
    // Toggle is not active
    build.toggles = [{ id: "test_toggle", active: false }];
    const mods = collectModifiers(build, gameData);
    expect(mods.find((m) => m.id === "toggle-test")).toBeUndefined();
  });

  it("includes toggle-conditioned modifiers when toggle is active", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.extraModifiers = [
      {
        id: "toggle-test",
        sourceType: "buff",
        sourceId: "test",
        targetStat: "increased_damage",
        operation: "add",
        value: 50,
        conditions: [{ type: "toggle", value: "test_toggle" }],
      },
    ];
    build.toggles = [{ id: "test_toggle", active: true }];
    const mods = collectModifiers(build, gameData);
    expect(mods.find((m) => m.id === "toggle-test")).toBeDefined();
  });

  it("includes unconditional modifiers always", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.extraModifiers = [
      {
        id: "uncond-test",
        sourceType: "buff",
        sourceId: "test",
        targetStat: "increased_damage",
        operation: "add",
        value: 10,
      },
    ];
    const mods = collectModifiers(build, gameData);
    expect(mods.find((m) => m.id === "uncond-test")).toBeDefined();
  });
});

// ── Blessing collection tests ──────────────────────────

describe("blessing collection", () => {
  it("collects blessing modifiers when blessings are in game data", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.blessings = [{ blessingId: "test-blessing" }];

    const gameDataWithBlessings = {
      ...gameData,
      blessings: [
        {
          id: "test-blessing",
          name: "Test Blessing",
          description: "A test",
          modifiers: [
            {
              id: "blessing-mod-1",
              sourceType: "blessing" as const,
              sourceId: "test-blessing",
              targetStat: "increased_fire_damage" as const,
              operation: "add" as const,
              value: 30,
            },
          ],
        },
      ],
    };

    const mods = collectModifiers(build, gameDataWithBlessings);
    const blessingMod = mods.find((m) => m.sourceType === "blessing");
    expect(blessingMod).toBeDefined();
    expect(blessingMod!.value).toBe(30);
    expect(blessingMod!.targetStat).toBe("increased_fire_damage");
  });

  it("ignores blessings not found in game data", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.blessings = [{ blessingId: "nonexistent-blessing" }];
    const mods = collectModifiers(build, gameData);
    const blessingMods = mods.filter((m) => m.sourceType === "blessing");
    expect(blessingMods.length).toBe(0);
  });
});

// ── Defensive derived stats tests ──────────────────────

describe("defensive derived stats", () => {
  it("computes armor damage reduction", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Equip a helmet with 14 armor
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const snap = computeSnapshot(build, gameData);

    // armor = 14, DR = 14 / (14 + 1400) = ~0.99% 
    expect(snap.stats["armor_damage_reduction"]).toBeGreaterThan(0);
    expect(snap.stats["armor_damage_reduction"]).toBeLessThan(5);
  });

  it("computes dodge chance from dodge rating", () => {
    const build = createEmptyBuild("mage", "runemaster");
    // Add dodge rating via custom modifier
    build.config.customModifiers = [
      { targetStat: "dodge_rating", operation: "add", value: 700 },
    ];
    const snap = computeSnapshot(build, gameData);

    // dodge = 700 / (700 + 700) = 50%
    expect(snap.stats["dodge_chance"]).toBeCloseTo(50, 0);
  });

  it("computes block damage reduction", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "block_chance", operation: "add", value: 50 },
      { targetStat: "block_effectiveness", operation: "add", value: 80 },
    ];
    const snap = computeSnapshot(build, gameData);

    // 50% chance × 80% effectiveness = 40% avg block DR
    expect(snap.stats["block_damage_reduction"]).toBeCloseTo(40, 0);
  });

  it("computes glancing blow damage reduction", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "glancing_blow_chance", operation: "add", value: 60 },
    ];
    const snap = computeSnapshot(build, gameData);

    // 60% chance × 35% base reduction = 21%
    expect(snap.stats["glancing_blow_damage_reduction"]).toBeCloseTo(21, 0);
  });

  it("computes effective health higher than raw health when armor is present", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const snap = computeSnapshot(build, gameData);

    const rawHealth = (snap.stats["health"] ?? 0) + (snap.stats["ward"] ?? 0);
    expect(snap.stats["effective_health"]).toBeGreaterThan(rawHealth);
  });
});

// ── Enemy ailment condition tests ──────────────────────

describe("enemy ailment conditions", () => {
  it("enemy shocked enables vs-shocked damage bonuses", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "damage_to_shocked", operation: "add", value: 30 },
    ];

    build.config.enemyIsShocked = false;
    const snapOff = computeSnapshot(build, gameData, "lightningblast");

    build.config.enemyIsShocked = true;
    const snapOn = computeSnapshot(build, gameData, "lightningblast");

    expect(snapOn.offensive.expectedDps).toBeGreaterThan(snapOff.offensive.expectedDps);
  });

  it("enemy chilled enables vs-chilled damage bonuses", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "damage_to_chilled", operation: "add", value: 30 },
    ];

    build.config.enemyIsChilled = false;
    const snapOff = computeSnapshot(build, gameData, "lightningblast");

    build.config.enemyIsChilled = true;
    const snapOn = computeSnapshot(build, gameData, "lightningblast");

    expect(snapOn.offensive.expectedDps).toBeGreaterThan(snapOff.offensive.expectedDps);
  });

  it("enemy ignited enables vs-ignited damage bonuses", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "damage_to_ignited", operation: "add", value: 30 },
    ];

    build.config.enemyIsIgnited = false;
    const snapOff = computeSnapshot(build, gameData, "lightningblast");

    build.config.enemyIsIgnited = true;
    const snapOn = computeSnapshot(build, gameData, "lightningblast");

    expect(snapOn.offensive.expectedDps).toBeGreaterThan(snapOff.offensive.expectedDps);
  });

  it("enemy boss enables vs-boss damage bonuses", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.customModifiers = [
      { targetStat: "damage_to_bosses", operation: "add", value: 50 },
    ];

    build.config.enemyIsBoss = false;
    const snapOff = computeSnapshot(build, gameData, "lightningblast");

    build.config.enemyIsBoss = true;
    const snapOn = computeSnapshot(build, gameData, "lightningblast");

    expect(snapOn.offensive.expectedDps).toBeGreaterThan(snapOff.offensive.expectedDps);
  });

  it("armor shred stacks reduce enemy mitigation", () => {
    const build = createEmptyBuild("mage", "runemaster");
    build.config.enemyLevel = 100;

    build.config.enemyArmorShredStacks = 0;
    const snapNoShred = computeSnapshot(build, gameData, "lightningblast");

    build.config.enemyArmorShredStacks = 20;
    const snapWithShred = computeSnapshot(build, gameData, "lightningblast");

    expect(snapWithShred.offensive.expectedDps).toBeGreaterThan(
      snapNoShred.offensive.expectedDps,
    );
  });
});

// ── Snapshot defensive summary tests ───────────────────

describe("snapshot defensive summary", () => {
  it("includes new defensive fields in snapshot", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = equipItem(build, "helmet", createEquippedItem("helmet-0-0"));
    const snap = computeSnapshot(build, gameData);

    expect(snap.defensive).toHaveProperty("armorDamageReduction");
    expect(snap.defensive).toHaveProperty("dodgeChance");
    expect(snap.defensive).toHaveProperty("blockDamageReduction");
    expect(snap.defensive).toHaveProperty("blockEffectiveness");
    expect(snap.defensive).toHaveProperty("glancingBlowChance");
    expect(snap.defensive).toHaveProperty("glancingBlowDamageReduction");
    expect(snap.defensive).toHaveProperty("enduranceThreshold");
    expect(snap.defensive).toHaveProperty("lessDamageTaken");
  });
});
