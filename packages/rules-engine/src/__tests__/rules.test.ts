import { describe, it, expect } from "vitest";
import { validateBuild, validatePassives, validateSkills } from "../validate.js";
import {
  createEmptyBuild,
  allocatePassive,
  addSkill,
} from "@eob/build-model";
import { getGameData } from "@eob/game-data";

const gameData = getGameData();

describe("validatePassives", () => {
  it("returns no errors for a valid build", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Arcanist (mage-base:0): max 8
    build = allocatePassive(build, "mage-base:0", 3);
    const errors = validatePassives(build, gameData);
    expect(errors).toHaveLength(0);
  });

  it("errors when exceeding max points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Arcanist (mage-base:0): max 8, allocate 10
    build = allocatePassive(build, "mage-base:0", 10);
    const errors = validatePassives(build, gameData);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain("exceeds max");
  });

  it("errors when prerequisite not allocated", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // Arcane Current (mage-base:6) requires Elementalist (mage-base:2) 1pt
    build = allocatePassive(build, "mage-base:6", 1);
    const errors = validatePassives(build, gameData);
    expect(errors.some((e) => e.message.includes("prerequisite"))).toBe(true);
  });

  it("errors when mastery node used without mastery", () => {
    let build = createEmptyBuild("mage"); // no mastery
    // Quintessence of Triumph (runemaster:54) is a runemaster node
    build = allocatePassive(build, "runemaster:54", 1);
    const errors = validatePassives(build, gameData);
    expect(errors.some((e) => e.message.includes("requires mastery"))).toBe(true);
  });
});

describe("validateSkills", () => {
  it("returns no errors for valid skills", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = addSkill(build, "runic-invocation");
    const errors = validateSkills(build, gameData);
    expect(errors).toHaveLength(0);
  });

  it("errors on more than 5 skills", () => {
    const build = createEmptyBuild("mage", "runemaster");
    // Force 6 skills (bypass addSkill limit)
    build.skills = [
      { skillId: "s1", allocatedNodes: [] },
      { skillId: "s2", allocatedNodes: [] },
      { skillId: "s3", allocatedNodes: [] },
      { skillId: "s4", allocatedNodes: [] },
      { skillId: "s5", allocatedNodes: [] },
      { skillId: "s6", allocatedNodes: [] },
    ];
    const errors = validateSkills(build, gameData);
    expect(errors.some((e) => e.message.includes("Too many"))).toBe(true);
  });
});

describe("validateBuild", () => {
  it("returns combined errors", () => {
    let build = createEmptyBuild("mage");
    // Quintessence of Triumph (runemaster:54) requires runemaster mastery
    build = allocatePassive(build, "runemaster:54", 1);
    const errors = validateBuild(build, gameData);
    expect(errors.length).toBeGreaterThan(0);
  });
});
