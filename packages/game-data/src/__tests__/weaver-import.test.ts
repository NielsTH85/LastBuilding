import { describe, it, expect } from "vitest";
import { getImportedPassiveTrees } from "../data/maxroll-adapter.js";
import { getImportedWeaverTree } from "../data/weaver-tree-adapter.js";
import { convertMaxrollProfile, type MaxrollProfile } from "../data/maxroll-build-import.js";

describe("weaver tree integration", () => {
  it("weaver tree has nodes and ornaments", () => {
    const weaver = getImportedWeaverTree();

    expect(weaver).toBeDefined();
    expect(weaver.nodes.length).toBeGreaterThan(0);
    expect((weaver.ornaments ?? []).length).toBeGreaterThan(0);
  });

  it("weaver tree is not included in passive trees", () => {
    const trees = getImportedPassiveTrees("mage");
    const weaver = trees.find((t) => t.id === "weaver");
    expect(weaver).toBeUndefined();
  });

  it("maps maxroll weaver history to passive allocations", () => {
    const profile: MaxrollProfile = {
      name: "Weaver Test",
      class: 0,
      mastery: 0,
      level: 100,
      items: {},
      activeSkills: [],
      specializedSkills: [],
      skillTrees: {},
      passives: {
        history: [],
        position: 0,
      },
      idols: [],
      blessings: [],
      weaver: {
        history: [1, 1, 2],
        position: 3,
      },
    };

    const converted = convertMaxrollProfile(profile, {});
    const node1 = converted.passives.find((p) => p.nodeId === "weaver:1");
    const node2 = converted.passives.find((p) => p.nodeId === "weaver:2");

    expect(node1?.points).toBe(2);
    expect(node2?.points).toBe(1);
  });
});
