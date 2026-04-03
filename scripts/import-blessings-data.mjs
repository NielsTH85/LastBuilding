#!/usr/bin/env node
/**
 * Import blessings from maxroll-game-data.json
 * into a structured JSON for the game-data package.
 *
 * Usage:  node scripts/import-blessings-data.mjs
 * Output: packages/game-data/src/data/blessings-import.json
 */

import { readFileSync, writeFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, "..");
const RAW_PATH = resolve(ROOT, "maxroll-game-data.json");
const OUT_PATH = resolve(ROOT, "packages/game-data/src/data/blessings-import.json");

const raw = JSON.parse(readFileSync(RAW_PATH, "utf-8"));

// Blessings are itemType 34
const blessingType = raw.itemTypes[34];
if (!blessingType) {
  console.error("Could not find itemType 34 (Blessing) in game data");
  process.exit(1);
}

const subItems = blessingType.subItems;
if (!subItems || !subItems.length) {
  console.error("No blessing sub-items found");
  process.exit(1);
}

// Also extract timeline data for blessing → timeline mapping
const timelines = raw.timelines || [];

const blessings = [];

for (const sub of subItems) {
  if (!sub || !sub.implicits || sub.implicits.length === 0) continue;

  blessings.push({
    subType: sub.subTypeID,
    displayName: sub.displayName || sub.name,
    implicits: sub.implicits.map((imp) => ({
      property: imp.property,
      tags: imp.tags || 0,
      specialTag: imp.specialTag || 0,
      type: imp.type || 0,
      minValue: imp.implicitValue,
      maxValue: imp.implicitMaxValue,
    })),
  });
}

writeFileSync(OUT_PATH, JSON.stringify(blessings, null, 2) + "\n");
console.log(`Wrote ${blessings.length} blessings to ${OUT_PATH}`);
