/**
 * Maps skill IDs and node names to icon filenames extracted from game assets.
 * Icons live in /icons/all/ as PNGs extracted from skill_icons_assets_all.bundle.
 */

const ICON_BASE = "/icons/all/";
const TREE_ICON_BASE = "/icons/tree/";

import rawSkillIconMap from "./skill-icon-map.json" with { type: "json" };

const skillIconMap = rawSkillIconMap as Record<string, string>;

/** Resolve the full icon URL for a skill */
export function getSkillIcon(skillId: string): string | undefined {
  const mapped =
    skillIconMap[skillId] ?? (skillId === "icebarrage" ? skillIconMap.glacier : undefined);
  if (mapped) return ICON_BASE + mapped;
  return undefined;
}

/**
 * Resolve an icon URL for a skill tree node.
 * Root nodes use the parent skill icon; other nodes use the treeAtlas icon ID.
 */
export function getNodeIcon(
  _nodeName: string,
  parentSkillId?: string,
  treeIconId?: number,
): string | undefined {
  if (parentSkillId) {
    const skillIcon = skillIconMap[parentSkillId];
    if (skillIcon) return ICON_BASE + skillIcon;
  }
  if (treeIconId != null) {
    return TREE_ICON_BASE + treeIconId + ".png";
  }
  return undefined;
}

/** Default fallback icon for nodes without a mapped icon */
export const DEFAULT_NODE_ICON = ICON_BASE + "icons2_0.png";
