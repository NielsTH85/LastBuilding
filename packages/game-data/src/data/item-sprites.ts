/**
 * Item sprite lookup — maps item base IDs and unique IDs to image paths.
 */

import itemSpriteMap from "./item-sprites.json" with { type: "json" };
import uniqueSpriteMap from "./unique-sprites.json" with { type: "json" };

const itemSprites = itemSpriteMap as Record<string, string>;
const uniqueSprites = uniqueSpriteMap as Record<string, string>;

/**
 * Get the sprite image path for an item base.
 * @param baseId The ItemBaseDef.id (format: "{slot}-{baseTypeId}-{subTypeId}")
 * @returns The image path relative to /images/items/, or undefined if not found.
 */
export function getItemSprite(baseId: string): string | undefined {
  // Support imported synthetic idol IDs, e.g. idol-30-11.
  const syntheticIdMatch = baseId.match(/^[a-zA-Z]+-(\d+)-(\d+)$/);
  if (syntheticIdMatch) {
    const key = `${syntheticIdMatch[1]}_${syntheticIdMatch[2]}`;
    const syntheticSprite = itemSprites[key];
    if (syntheticSprite) return syntheticSprite;
  }

  // Convert "{slot}-{baseTypeId}-{subTypeId}" to "{baseTypeId}_{subTypeId}"
  const parts = baseId.split("-");
  if (parts.length < 3) return undefined;
  const key = `${parts[1]}_${parts[2]}`;
  return itemSprites[key];
}

/**
 * Get the sprite image path for a unique item.
 * @param uniqueId The numeric unique item ID.
 * @returns The image path relative to /images/items/uniques/, or undefined.
 */
export function getUniqueSprite(uniqueId: number): string | undefined {
  return uniqueSprites[String(uniqueId)];
}
