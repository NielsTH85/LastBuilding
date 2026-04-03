/**
 * Curated registry of unique items with configurable conditional effects.
 *
 * Each entry defines what settings to show in the configuration panel and
 * how they affect the item's modifiers:
 *
 * - `conditionalModIndices`: Mod indices (from the raw `mods[]` array) that
 *    should only apply when the toggle is active.
 * - `extraModifiers`: Additional modifiers not in the raw mod array
 *    (described only in tooltip text). For stacks, values are per-stack.
 */

import type { StatId } from "../stats.js";
import type { ModifierOperation } from "../modifiers.js";

export interface UniqueExtraModifier {
  targetStat: StatId;
  operation: ModifierOperation;
  value: number;
  /** If true and the setting type is "stacks", final value = value × stacks. */
  perStack?: boolean;
}

export interface UniqueSettingDef {
  /** Toggle ID stored in build.toggles (e.g., "unique-11-active"). */
  id: string;
  /** UI label shown in the config panel. */
  label: string;
  type: "toggle" | "stacks";
  /** Maximum stack count (only for type "stacks"). */
  max?: number;
  /** Default stack count or toggle state. */
  defaultValue?: number;
  /** Indices into the unique's mods[] that only apply when this setting is active. */
  conditionalModIndices?: number[];
  /** Extra modifiers to inject when active. For stacks, use perStack: true. */
  extraModifiers?: UniqueExtraModifier[];
}

export interface UniqueToggleDef {
  uniqueId: number;
  /** Display name (falls back to the unique item name). */
  name?: string;
  settings: UniqueSettingDef[];
}

/**
 * Registry of unique items with configurable conditional effects.
 * Key: uniqueID → toggle definitions.
 */
const entries: [number, UniqueToggleDef][] = [
  // ── Exsanguinous ─────────────────────────────────────
  // "[15,30]% increased attack/cast/movement speed if you have used a potion recently"
  // Mods 0-2 are attack speed, cast speed, movement speed (conditional on potion)
  [
    11,
    {
      uniqueId: 11,
      settings: [
        {
          id: "unique-11-potion",
          label: "Used a potion recently",
          type: "toggle",
          conditionalModIndices: [0, 1, 2],
        },
      ],
    },
  ],

  // ── Eye of Reen ──────────────────────────────────────
  // "Each stack of Reen's Ire grants 5% melee crit multi and 10% increased fire DoT"
  [
    35,
    {
      uniqueId: 35,
      settings: [
        {
          id: "unique-35-stacks",
          label: "Reen's Ire stacks",
          type: "stacks",
          max: 6,
          extraModifiers: [
            { targetStat: "crit_multiplier", operation: "increased", value: 5, perStack: true },
            { targetStat: "damage_over_time", operation: "increased", value: 10, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Soulfire ─────────────────────────────────────────
  // "60% increased fire damage if you have killed an enemy recently"
  // "100% increased armor while ignited"
  [
    70,
    {
      uniqueId: 70,
      settings: [
        {
          id: "unique-70-kill",
          label: "Killed an enemy recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "increased_damage", operation: "increased", value: 60 },
          ],
        },
        {
          id: "unique-70-ignited",
          label: "You are Ignited",
          type: "toggle",
          extraModifiers: [{ targetStat: "armor", operation: "increased", value: 100 }],
        },
      ],
    },
  ],

  // ── Ignivar's Head ───────────────────────────────────
  // "Cast Fire Aura every second while Channelling"
  // "Disintegrate deals more damage equal to your spell crit chance"
  [
    74,
    {
      uniqueId: 74,
      settings: [
        {
          id: "unique-74-channel",
          label: "Channelling",
          type: "toggle",
          // Fire aura is a proc, not a stat mod — no mechanical effect here
        },
      ],
    },
  ],

  // ── Symbol of Demise ─────────────────────────────────
  // "Each stack of Demise grants 10% Bleed Chance (up to 200%)"
  // "Each stack of Demise grants 1% increased Bleed Duration"
  [
    123,
    {
      uniqueId: 123,
      settings: [
        {
          id: "unique-123-stacks",
          label: "Demise stacks",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "ailment_chance", operation: "add", value: 10, perStack: true },
            { targetStat: "ailment_duration" as StatId, operation: "increased", value: 1, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Flight of the First ──────────────────────────────
  // "+2 Arrows", "100% increased Crit Chance", "+100% Crit Avoidance" while Ancient Flight
  [
    168,
    {
      uniqueId: 168,
      settings: [
        {
          id: "unique-168-flight",
          label: "Ancient Flight active",
          type: "toggle",
          extraModifiers: [
            { targetStat: "crit_chance", operation: "increased", value: 100 },
            { targetStat: "crit_avoidance" as StatId, operation: "add", value: 100 },
          ],
        },
      ],
    },
  ],

  // ── Ruby Fang Aegis ──────────────────────────────────
  // "15% increased Fire Damage per stack of Ruby Venom"
  // "15% increased Poison Damage per stack of Ruby Venom"
  [
    174,
    {
      uniqueId: 174,
      settings: [
        {
          id: "unique-174-stacks",
          label: "Ruby Venom stacks",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "increased_damage", operation: "increased", value: 15, perStack: true },
            { targetStat: "increased_damage", operation: "increased", value: 15, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Jasper's Searing Pride ───────────────────────────
  // "Each stack of Searing Blades grants +2 melee fire damage and 20% melee ignite chance"
  [
    190,
    {
      uniqueId: 190,
      settings: [
        {
          id: "unique-190-stacks",
          label: "Searing Blades stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "damage", operation: "add", value: 2, perStack: true },
            { targetStat: "ailment_chance", operation: "add", value: 20, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Ravenous Void ────────────────────────────────────
  // "You take 5% less damage per stack" (up to 3)
  [
    208,
    {
      uniqueId: 208,
      settings: [
        {
          id: "unique-208-stacks",
          label: "Void Barrier stacks",
          type: "stacks",
          max: 3,
          extraModifiers: [
            { targetStat: "less_damage_taken", operation: "more", value: -5, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Throne of Ambition ───────────────────────────────
  // "2% more Fire Damage per stack of Ambition"
  [
    211,
    {
      uniqueId: 211,
      settings: [
        {
          id: "unique-211-stacks",
          label: "Ambition stacks",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 2, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Foot of the Mountain ─────────────────────────────
  // "-2 Mana Cost per stack of Mountain's Endurance"
  [
    253,
    {
      uniqueId: 253,
      settings: [
        {
          id: "unique-253-stacks",
          label: "Mountain's Endurance stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "mana_cost", operation: "add", value: -2, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Branch of Hallows ────────────────────────────────
  // "Each stack of Maelstrom grants [3,4] Ward per second"
  [
    274,
    {
      uniqueId: 274,
      settings: [
        {
          id: "unique-274-stacks",
          label: "Maelstrom stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "ward_generation", operation: "add", value: 3, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Abacus Rod ───────────────────────────────────────
  // "+5 Spell Damage per stack of Numeromancy"
  [
    308,
    {
      uniqueId: 308,
      settings: [
        {
          id: "unique-308-stacks",
          label: "Numeromancy stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "spell_damage", operation: "add", value: 5, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Event Horizon ────────────────────────────────────
  // "15% more Melee Damage per stack of Dilation"
  [
    364,
    {
      uniqueId: 364,
      settings: [
        {
          id: "unique-364-stacks",
          label: "Dilation stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 15, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Beast King ───────────────────────────────────────
  // "8% less damage taken if your minions have killed recently"
  // "minions take 25% less damage if you have killed recently"
  [
    28,
    {
      uniqueId: 28,
      settings: [
        {
          id: "unique-28-minion-kill",
          label: "Minions killed recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "less_damage_taken", operation: "more", value: -8 },
          ],
        },
        {
          id: "unique-28-player-kill",
          label: "You killed recently",
          type: "toggle",
          // Minion defensive buff — no direct player stat effect
        },
      ],
    },
  ],

  // ── Close Call ───────────────────────────────────────
  // "40% increased dodge rating for each hit you have blocked recently"
  [
    51,
    {
      uniqueId: 51,
      settings: [
        {
          id: "unique-51-stacks",
          label: "Hits blocked recently",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "dodge_rating", operation: "increased", value: 40, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Isadora's Gravechill ─────────────────────────────
  // "+100% chance to chill with necrotic abilities if you have killed recently"
  [
    26,
    {
      uniqueId: 26,
      settings: [
        {
          id: "unique-26-kill",
          label: "Killed recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "chill_chance", operation: "add", value: 100 },
          ],
        },
      ],
    },
  ],

  // ── The Last Laugh ───────────────────────────────────
  // "+5% melee critical strike chance if you have less than 100 dodge rating"
  [
    47,
    {
      uniqueId: 47,
      settings: [
        {
          id: "unique-47-dodge",
          label: "Less than 100 dodge rating",
          type: "toggle",
          extraModifiers: [
            { targetStat: "base_crit_chance", operation: "add", value: 5 },
          ],
        },
      ],
    },
  ],

  // ── Heirloom of Light ────────────────────────────────
  // "1% increased spell damage per level if you have cast radiant nova recently"
  [
    69,
    {
      uniqueId: 69,
      settings: [
        {
          id: "unique-69-nova",
          label: "Cast radiant nova recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "increased_spell_damage", operation: "increased", value: 100 },
          ],
        },
      ],
    },
  ],

  // ── Gambler's Fallacy ────────────────────────────────
  // "+100% Critical Strike Chance if you have not dealt a Critical Strike Recently"
  [
    130,
    {
      uniqueId: 130,
      settings: [
        {
          id: "unique-130-crit",
          label: "No critical strike recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "crit_chance", operation: "add", value: 100 },
          ],
        },
      ],
    },
  ],

  // ── Scales of Eterra (Cold / Fire) ───────────────────
  // Cold Infusion: 10% more cold damage per stack; Fire Infusion: 10% more fire damage per stack
  [
    195,
    {
      uniqueId: 195,
      settings: [
        {
          id: "unique-195-cold",
          label: "Cold Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
        {
          id: "unique-195-fire",
          label: "Fire Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Scales of Eterra (Cold / Lightning) ──────────────
  [
    196,
    {
      uniqueId: 196,
      settings: [
        {
          id: "unique-196-cold",
          label: "Cold Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
        {
          id: "unique-196-lightning",
          label: "Lightning Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Scales of Eterra (Fire / Lightning) ──────────────
  [
    197,
    {
      uniqueId: 197,
      settings: [
        {
          id: "unique-197-fire",
          label: "Fire Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
        {
          id: "unique-197-lightning",
          label: "Lightning Infusion stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 10, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Sacrificial Embrace ──────────────────────────────
  // "Each stack of Abyssal Rite grants +20 spell void damage and 20% void pen"
  [
    217,
    {
      uniqueId: 217,
      settings: [
        {
          id: "unique-217-stacks",
          label: "Abyssal Rite stacks",
          type: "stacks",
          max: 10,
          extraModifiers: [
            { targetStat: "spell_damage", operation: "add", value: 20, perStack: true },
            { targetStat: "penetration_void", operation: "add", value: 20, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Death's Embrace ──────────────────────────────────
  // "Grim Harvest grants 200% more melee damage for one attack"
  [
    220,
    {
      uniqueId: 220,
      settings: [
        {
          id: "unique-220-grim",
          label: "Grim Harvest active",
          type: "toggle",
          extraModifiers: [
            { targetStat: "more_melee_damage", operation: "more", value: 200 },
          ],
        },
      ],
    },
  ],

  // ── Tu'rani's Bident ─────────────────────────────────
  // "Each stack of Tu'rani's Thunder grants +[8,12] Spell Lightning Damage"
  [
    226,
    {
      uniqueId: 226,
      settings: [
        {
          id: "unique-226-stacks",
          label: "Tu'rani's Thunder stacks",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "added_spell_lightning_damage", operation: "add", value: 8, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Pyre of Affliction ───────────────────────────────
  // "+[10,16]% Necrotic Penetration per stack of Damned on You"
  [
    259,
    {
      uniqueId: 259,
      settings: [
        {
          id: "unique-259-stacks",
          label: "Damned stacks on you",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "penetration_necrotic", operation: "add", value: 10, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Soul Gambler's Fallacy ───────────────────────────
  // "+100% Critical Strike Chance if no critical strike recently"
  [
    265,
    {
      uniqueId: 265,
      settings: [
        {
          id: "unique-265-crit",
          label: "No critical strike recently",
          type: "toggle",
          extraModifiers: [
            { targetStat: "crit_chance", operation: "add", value: 100 },
          ],
        },
      ],
    },
  ],

  // ── Lament of the Lost Refuge ────────────────────────
  // "5% Movement Speed and Mana Regen + 5 Spell Void Damage per stack of Corrupted Heraldry"
  [
    273,
    {
      uniqueId: 273,
      settings: [
        {
          id: "unique-273-stacks",
          label: "Corrupted Heraldry stacks",
          type: "stacks",
          max: 20,
          extraModifiers: [
            { targetStat: "movement_speed", operation: "increased", value: 5, perStack: true },
            { targetStat: "mana_regen", operation: "increased", value: 5, perStack: true },
            { targetStat: "spell_damage", operation: "add", value: 5, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Red Ring of Atlaria ──────────────────────────────
  // "10% less Damage Taken if you have at least 180 Total Attributes"
  [
    277,
    {
      uniqueId: 277,
      settings: [
        {
          id: "unique-277-attr",
          label: "At least 180 total attributes",
          type: "toggle",
          extraModifiers: [
            { targetStat: "less_damage_taken", operation: "more", value: -10 },
          ],
        },
      ],
    },
  ],

  // ── The Shattered Cycle ──────────────────────────────
  // "Dawn to Dusk: +48 Spell Damage, 24% increased area"
  // "Dusk to Midnight: +96 Spell Damage, 48% increased area"
  [
    318,
    {
      uniqueId: 318,
      settings: [
        {
          id: "unique-318-dawn",
          label: "Dawn to Dusk active",
          type: "toggle",
          extraModifiers: [
            { targetStat: "spell_damage", operation: "add", value: 48 },
            { targetStat: "area", operation: "increased", value: 24 },
          ],
        },
        {
          id: "unique-318-dusk",
          label: "Dusk to Midnight active",
          type: "toggle",
          extraModifiers: [
            { targetStat: "spell_damage", operation: "add", value: 96 },
            { targetStat: "area", operation: "increased", value: 48 },
          ],
        },
      ],
    },
  ],

  // ── Mana Guide ───────────────────────────────────────
  // "50% less armor while channeling Focus"
  [
    368,
    {
      uniqueId: 368,
      settings: [
        {
          id: "unique-368-channel",
          label: "Channelling Focus",
          type: "toggle",
          extraModifiers: [
            { targetStat: "armor", operation: "more", value: -50 },
          ],
        },
      ],
    },
  ],

  // ── Crystalwind ──────────────────────────────────────
  // "Consume stacks to deal [8,15]% more damage per stack (max 8)"
  [
    378,
    {
      uniqueId: 378,
      settings: [
        {
          id: "unique-378-stacks",
          label: "Crystalwind stacks",
          type: "stacks",
          max: 8,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 8, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Scissor of Atropos ───────────────────────────────
  // "+8% throwing crit chance and +8 throwing phys damage per stack of Kismet (max 8)"
  [
    418,
    {
      uniqueId: 418,
      settings: [
        {
          id: "unique-418-stacks",
          label: "Kismet stacks",
          type: "stacks",
          max: 8,
          extraModifiers: [
            { targetStat: "crit_chance", operation: "add", value: 8, perStack: true },
            { targetStat: "throwing_damage", operation: "add", value: 8, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Executioner's Tithe ──────────────────────────────
  // "Spirit Battery grants [2,4]% increased mana per stack"
  [
    420,
    {
      uniqueId: 420,
      settings: [
        {
          id: "unique-420-stacks",
          label: "Spirit Battery stacks",
          type: "stacks",
          max: 12,
          extraModifiers: [
            { targetStat: "mana", operation: "increased", value: 2, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Army of Skin ─────────────────────────────────────
  // "Each stack of Excoriation grants 13% increased AoE and +5 Melee Damage (max 13)"
  [
    443,
    {
      uniqueId: 443,
      settings: [
        {
          id: "unique-443-stacks",
          label: "Excoriation stacks",
          type: "stacks",
          max: 13,
          extraModifiers: [
            { targetStat: "area", operation: "increased", value: 13, perStack: true },
            { targetStat: "melee_damage", operation: "add", value: 5, perStack: true },
          ],
        },
      ],
    },
  ],

  // ── Bones of the Ancestral Pack ──────────────────────
  // "4% more damage, 3% attack/cast speed, 2% CDR per stack of Ancestral Pack"
  [
    447,
    {
      uniqueId: 447,
      settings: [
        {
          id: "unique-447-stacks",
          label: "Ancestral Pack stacks",
          type: "stacks",
          max: 30,
          extraModifiers: [
            { targetStat: "more_damage", operation: "more", value: 4, perStack: true },
            { targetStat: "attack_speed", operation: "increased", value: 3, perStack: true },
            { targetStat: "cast_speed", operation: "increased", value: 3, perStack: true },
            { targetStat: "cooldown_recovery_speed", operation: "increased", value: 2, perStack: true },
          ],
        },
      ],
    },
  ],
];

export const UNIQUE_TOGGLE_REGISTRY: Map<number, UniqueToggleDef> = new Map(entries);

/** Look up toggle definitions for a specific unique item. */
export function getUniqueToggles(uniqueId: number): UniqueToggleDef | undefined {
  return UNIQUE_TOGGLE_REGISTRY.get(uniqueId);
}

/** Get all unique IDs that have toggle definitions. */
export function getUniqueIdsWithToggles(): number[] {
  return [...UNIQUE_TOGGLE_REGISTRY.keys()];
}
