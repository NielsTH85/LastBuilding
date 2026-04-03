import type { Build } from "@eob/build-model";

export const CURRENT_VERSION = "0.3.8";

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

  // For now, trust the structure after basic checks.
  // In a future version, add schema validation.
  return parsed as Build;
}
