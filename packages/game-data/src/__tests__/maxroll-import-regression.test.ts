import { describe, expect, it } from "vitest";
import { convertMaxrollBuild, type MaxrollApiResponse } from "../data/maxroll-build-import.js";

describe("maxroll import regressions", () => {
  it("imports planner cg2j4d0n without throwing", async () => {
    const resp = await fetch("https://planners.maxroll.gg/profiles/last-epoch/cg2j4d0n", {
      headers: {
        Accept: "application/json",
        Origin: "https://maxroll.gg",
      },
    });

    expect(resp.ok).toBe(true);
    const api = (await resp.json()) as MaxrollApiResponse;

    expect(() => convertMaxrollBuild(api)).not.toThrow();

    const result = convertMaxrollBuild(api);
    expect(result.profiles.length).toBeGreaterThan(0);
  });
});
