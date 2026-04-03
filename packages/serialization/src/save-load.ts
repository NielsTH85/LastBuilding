import type { Build } from "@eob/build-model";

export const CURRENT_VERSION = "0.3.12";

/**
 * Serialize a build to a JSON string for saving.
 */
export function saveBuild(build: Build): string {
  return JSON.stringify({ ...build, version: CURRENT_VERSION }, null, 2);
}

/**
 * Deserialize a JSON string back to a Build.
 * Performs basic validation.
 */
export function loadBuild(json: string): Build {
  const parsed: unknown = JSON.parse(json);

  if (typeof parsed !== "object" || parsed === null) {
    throw new Error("Invalid build data: expected an object");
  }

  const obj = parsed as Record<string, unknown>;

  if (typeof obj["version"] !== "string") {
    throw new Error("Invalid build data: missing version");
  }
  if (typeof obj["character"] !== "object" || obj["character"] === null) {
    throw new Error("Invalid build data: missing character");
  }

  const build = parsed as Build;
  if (!build.progression) {
    build.progression = {
      passives: {
        history: build.passives.flatMap((p) => Array.from({ length: p.points }, () => p.nodeId)),
        position: build.passives.reduce((sum, p) => sum + p.points, 0),
      },
      skills: Object.fromEntries(
        build.skills.map((s) => {
          const history = s.allocatedNodes.flatMap((n) =>
            Array.from({ length: n.points }, () => n.nodeId),
          );
          return [s.skillId, { history, position: history.length }];
        }),
      ),
    };
  }

  // For now, trust the structure after basic checks.
  // In a future version, add schema validation.
  return build;
}
