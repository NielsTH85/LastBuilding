import { describe, it, expect } from "vitest";
import { getUniqueToggles, UNIQUE_TOGGLE_REGISTRY } from "../data/unique-toggles.js";
import { convertUniqueMods, getUniqueItem } from "../data/uniques-adapter.js";

describe("unique toggle system", () => {
  it("registry has entries", () => {
    expect(UNIQUE_TOGGLE_REGISTRY.size).toBeGreaterThan(0);
  });

  it("getUniqueToggles returns definition for known unique", () => {
    const def = getUniqueToggles(11); // Exsanguinous
    expect(def).toBeDefined();
    expect(def!.settings.length).toBeGreaterThan(0);
    expect(def!.settings[0].type).toBe("toggle");
  });

  it("getUniqueToggles returns undefined for unknown unique", () => {
    expect(getUniqueToggles(999999)).toBeUndefined();
  });

  it("convertUniqueMods attaches conditions for conditional mod indices", () => {
    // Exsanguinous: mods 0-2 are conditional on toggle "unique-11-potion"
    const mods = convertUniqueMods(11);
    const conditional = mods.filter((m) => m.conditions && m.conditions.length > 0);
    expect(conditional.length).toBeGreaterThan(0);
    expect(conditional[0].conditions![0].type).toBe("toggle");
    expect(conditional[0].conditions![0].value).toBe("unique-11-potion");
  });

  it("convertUniqueMods adds extra modifiers when toggle is active", () => {
    // Soulfire (70): has "killed recently" toggle with extra fire damage
    const baseMods = convertUniqueMods(70);
    const withToggle = convertUniqueMods(70, undefined, [
      { id: "unique-70-kill", active: true },
    ]);
    expect(withToggle.length).toBeGreaterThan(baseMods.length);
    const extra = withToggle.find((m) => m.id.includes("extra"));
    expect(extra).toBeDefined();
  });

  it("convertUniqueMods scales stacks correctly", () => {
    // Close Call (51): 40% dodge per blocked hit stack
    const mods3 = convertUniqueMods(51, undefined, [
      { id: "unique-51-stacks", active: true, value: 3 },
    ]);
    const mods5 = convertUniqueMods(51, undefined, [
      { id: "unique-51-stacks", active: true, value: 5 },
    ]);
    const extra3 = mods3.find((m) => m.id.includes("extra"));
    const extra5 = mods5.find((m) => m.id.includes("extra"));
    expect(extra3).toBeDefined();
    expect(extra5).toBeDefined();
    // 3 stacks: 40 * 3 = 120, 5 stacks: 40 * 5 = 200
    expect(extra3!.value).toBe(120);
    expect(extra5!.value).toBe(200);
  });

  it("all registered uniques reference valid unique items", () => {
    for (const [uniqueId] of UNIQUE_TOGGLE_REGISTRY) {
      const item = getUniqueItem(uniqueId);
      expect(item, `unique ${uniqueId} should exist in data`).toBeDefined();
    }
  });
});
