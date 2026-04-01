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
    build = allocatePassive(build, "mb-arcane-focus", 3);
    const errors = validatePassives(build, gameData);
    expect(errors).toHaveLength(0);
  });

  it("errors when exceeding max points", () => {
    let build = createEmptyBuild("mage", "runemaster");
    build = allocatePassive(build, "mb-arcane-focus", 10); // max is 5
    const errors = validatePassives(build, gameData);
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0]!.message).toContain("exceeds max");
  });

  it("errors when prerequisite not allocated", () => {
    let build = createEmptyBuild("mage", "runemaster");
    // mb-spell-surge requires mb-arcane-focus
    build = allocatePassive(build, "mb-spell-surge", 1);
    const errors = validatePassives(build, gameData);
    expect(errors.some((e) => e.message.includes("prerequisite"))).toBe(true);
  });

  it("errors when mastery node used without mastery", () => {
    let build = createEmptyBuild("mage"); // no mastery
    build = allocatePassive(build, "rm-runic-power", 1);
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
    build = allocatePassive(build, "rm-runic-power", 1);
    const errors = validateBuild(build, gameData);
    expect(errors.length).toBeGreaterThan(0);
  });
});
