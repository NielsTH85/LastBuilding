import { describe, expect, it } from "vitest";
import rawImport from "../data/maxroll-import.json" with { type: "json" };
import { getImportedSkills } from "../data/maxroll-adapter.js";

describe("skills adapter coverage", () => {
  it("imports all skills from source dataset", () => {
    const classes = (rawImport as { classes: Array<{ skills: Record<string, unknown[]> }> })
      .classes;
    const expectedCount = classes.reduce((sum, cls) => {
      return sum + Object.values(cls.skills ?? {}).reduce((acc, list) => acc + list.length, 0);
    }, 0);

    const imported = getImportedSkills();
    expect(imported.length).toBe(expectedCount);
  });

  it("keeps modifiers for previously unmapped skill node stats", () => {
    // Summon Wolf tree node 2 has stat "Increased Dodge Rating Per Strength"
    // which was previously dropped when unmapped.
    const primalistSkills = getImportedSkills("primalist");
    const summonWolf = primalistSkills.find((s) => s.tree.id === "wo42");
    expect(summonWolf).toBeDefined();

    const node = summonWolf!.tree.nodes.find((n) => n.id === "wo42:2");
    expect(node).toBeDefined();
    expect(node!.modifiersPerPoint.length).toBeGreaterThan(0);

    const fallback = node!.modifiersPerPoint.find(
      (m) => m.targetStat === "increased_dodge_rating_per_strength",
    );
    expect(fallback).toBeDefined();
    expect(fallback!.value).toBe(3);
  });

  it("provides icons for imported skills", () => {
    const skills = getImportedSkills();
    const missing = skills.filter((s) => !s.icon);
    expect(missing).toHaveLength(0);
  });

  it("attaches baseline data for every imported skill", () => {
    const skills = getImportedSkills();
    const missing = skills.filter((s) => !s.baseline);
    expect(missing).toHaveLength(0);
  });
});
