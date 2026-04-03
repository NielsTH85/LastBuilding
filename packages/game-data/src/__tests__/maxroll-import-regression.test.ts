import { describe, expect, it } from "vitest";
import {
  convertMaxrollBuild,
  type ImportedBuild,
  type MaxrollApiResponse,
} from "../data/maxroll-build-import.js";
import { getGameData, getImportedWeaverTree } from "../index.js";
import cg2j4d0nFixture from "./fixtures/maxroll/cg2j4d0n.json" with { type: "json" };
import planner295tdl0oFixture from "./fixtures/maxroll/295tdl0o.json" with { type: "json" };

const FIXTURES: Array<{ id: string; api: MaxrollApiResponse }> = [
  { id: "cg2j4d0n", api: cg2j4d0nFixture as MaxrollApiResponse },
  { id: "295tdl0o", api: planner295tdl0oFixture as MaxrollApiResponse },
];

const gameData = getGameData();
const classIds = new Set(gameData.classes.map((c) => c.id));
const masteryIds = new Set(gameData.classes.flatMap((c) => c.masteries.map((m) => m.id)));
const passiveNodeIds = new Set(gameData.passiveTrees.flatMap((t) => t.nodes.map((n) => n.id)));
const weaverNodeIds = new Set(getImportedWeaverTree().nodes.map((n) => n.id));
for (const id of weaverNodeIds) {
  passiveNodeIds.add(id);
}
const skillIds = new Set(gameData.skills.map((s) => s.id));
const skillNodeIds = new Set(gameData.skills.flatMap((s) => s.tree.nodes.map((n) => n.id)));
const itemBaseIds = new Set(gameData.itemBases.map((b) => b.id));
const affixIds = new Set(gameData.affixes.map((a) => a.id));
const ALLOWED_UNKNOWN_AFFIX_IDS = new Set(["affix-710", "affix-768", "affix-949"]);

function fixtureById(id: string): MaxrollApiResponse {
  const fixture = FIXTURES.find((entry) => entry.id === id);
  if (!fixture) throw new Error(`Missing fixture for ${id}`);
  return fixture.api;
}

function expectFiniteNumber(value: unknown): void {
  expect(typeof value).toBe("number");
  expect(Number.isFinite(value)).toBe(true);
}

function assertImportedProfileShape(build: ImportedBuild): void {
  const unknownAffixIds = new Set<string>();

  expect(build.classId.length).toBeGreaterThan(0);
  expect(classIds.has(build.classId), `unknown classId: ${build.classId}`).toBe(true);
  if (build.masteryId) {
    expect(masteryIds.has(build.masteryId), `unknown masteryId: ${build.masteryId}`).toBe(true);
  }

  expectFiniteNumber(build.level);
  expect(build.level).toBeGreaterThan(0);

  for (const passive of build.passives) {
    expect(passive.nodeId.length).toBeGreaterThan(0);
    expect(passiveNodeIds.has(passive.nodeId), `unknown passive nodeId: ${passive.nodeId}`).toBe(
      true,
    );
    expectFiniteNumber(passive.points);
    expect(passive.points).toBeGreaterThan(0);
  }

  for (const skill of build.skills) {
    expect(skill.skillId.length).toBeGreaterThan(0);
    expect(skillIds.has(skill.skillId), `unknown skillId: ${skill.skillId}`).toBe(true);
    for (const node of skill.allocatedNodes) {
      expect(node.nodeId.length).toBeGreaterThan(0);
      expect(skillNodeIds.has(node.nodeId), `unknown skill nodeId: ${node.nodeId}`).toBe(true);
      expectFiniteNumber(node.points);
      expect(node.points).toBeGreaterThan(0);
    }
  }

  for (const item of build.equipment) {
    expect(itemBaseIds.has(item.baseId), `unknown item baseId: ${item.baseId}`).toBe(true);
    for (const affix of item.affixes) {
      expect(affix.affixId.length).toBeGreaterThan(0);
      if (!affixIds.has(affix.affixId)) {
        unknownAffixIds.add(affix.affixId);
      }
      expectFiniteNumber(affix.tier);
      expect(affix.tier).toBeGreaterThanOrEqual(0);
      expectFiniteNumber(affix.value);
    }
  }

  for (const idol of build.idols) {
    expectFiniteNumber(idol.slotIndex);
    expect(idol.slotIndex).toBeGreaterThanOrEqual(0);
    for (const affix of idol.affixes) {
      expect(affix.affixId.length).toBeGreaterThan(0);
      if (!affixIds.has(affix.affixId)) {
        unknownAffixIds.add(affix.affixId);
      }
      expectFiniteNumber(affix.tier);
      expect(affix.tier).toBeGreaterThanOrEqual(0);
      expectFiniteNumber(affix.value);
    }
  }

  for (const modifier of build.extraModifiers) {
    expectFiniteNumber(modifier.value);
  }

  const unexpectedUnknownAffixes = [...unknownAffixIds].filter(
    (affixId) => !ALLOWED_UNKNOWN_AFFIX_IDS.has(affixId),
  );
  expect(unexpectedUnknownAffixes, `unexpected unknown affix IDs: ${unexpectedUnknownAffixes.join(", ")}`).toEqual([]);
}

describe("maxroll import regressions", () => {
  it.each(FIXTURES)("imports planner $id without throwing and preserves invariants", ({ api }) => {

    expect(() => convertMaxrollBuild(api)).not.toThrow();

    const result = convertMaxrollBuild(api);
    expect(result.profiles.length).toBeGreaterThan(0);
    for (const profile of result.profiles) {
      assertImportedProfileShape(profile.build);
    }
  });

  it("handles missing blessing implicits arrays", () => {
    const api = fixtureById("cg2j4d0n");
    const buildData = JSON.parse(api.data) as { profiles?: { blessings?: Array<{ implicits?: unknown } | null> }[] };

    for (const profile of buildData.profiles ?? []) {
      for (const blessing of profile.blessings ?? []) {
        if (blessing) {
          delete blessing.implicits;
        }
      }
    }

    const mutatedApi: MaxrollApiResponse = {
      ...api,
      data: JSON.stringify(buildData),
    };

    expect(() => convertMaxrollBuild(mutatedApi)).not.toThrow();
  });
});
