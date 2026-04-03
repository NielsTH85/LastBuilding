import type { ItemSlot, ItemRarity, Modifier, StatId } from "@eob/game-data";

// ─── Character ─────────────────────────────────────────

export interface CharacterState {
  classId: string;
  masteryId?: string;
  level: number;
}

// ─── Passives ──────────────────────────────────────────

export interface PassiveAllocation {
  nodeId: string;
  points: number;
}

// ─── Skills ────────────────────────────────────────────

export interface SkillAllocation {
  skillId: string;
  allocatedNodes: { nodeId: string; points: number }[];
}

// ─── Equipment ─────────────────────────────────────────

export interface ItemAffixRoll {
  affixId: string;
  tier: number;
  value: number;
}

export interface EquippedItem {
  baseId: string;
  rarity: ItemRarity;
  affixes: ItemAffixRoll[];
  implicitRolls?: number[];
  implicits?: Modifier[];
  uniqueEffects?: Modifier[];
  uniqueId?: number;
  uniqueName?: string;
  seals?: ItemAffixRoll[];
  forgingPotential?: number;
  legendaryPotential?: number;
}

export type EquipmentState = Partial<Record<ItemSlot, EquippedItem>>;

// ─── Idols & Blessings ────────────────────────────────

export interface IdolState {
  idolId: string;
  slotIndex?: number;
  affixes?: ItemAffixRoll[];
}

export interface BlessingState {
  blessingId: string;
}

// ─── Toggles ───────────────────────────────────────────

export interface ToggleState {
  id: string;
  active: boolean;
  value?: number;
}

// ─── Simulation Config ─────────────────────────────────

export interface SimulationConfig {
  enemyLevel: number;
  enemyResistances?: Partial<Record<string, number>>;
  enemyNearbyCount?: number;

  // Enemy conditions
  enemyIsBoss?: boolean;
  enemyIsShocked?: boolean;
  enemyIsChilled?: boolean;
  enemyIsIgnited?: boolean;
  enemyIsPoisoned?: boolean;
  enemyIsBleeding?: boolean;
  enemyIsSlowed?: boolean;
  enemyIsStunned?: boolean;
  enemyArmorShredStacks?: number;

  // Player combat state
  playerAtFullHealth?: boolean;
  playerHasWard?: boolean;
  playerRecentlyUsedPotion?: boolean;
  playerRecentlyKilled?: boolean;
  playerRecentlyBeenHit?: boolean;
  playerMinionCount?: number;

  // Custom stat overrides (user-entered flat values)
  customModifiers?: { targetStat: string; operation: string; value: number }[];
}

// ─── Build ─────────────────────────────────────────────

export interface Build {
  version: string;
  character: CharacterState;
  passives: PassiveAllocation[];
  skills: SkillAllocation[];
  equipment: EquipmentState;
  extraModifiers?: Modifier[];
  idols: IdolState[];
  idolAltarId?: string;
  blessings: BlessingState[];
  toggles: ToggleState[];
  config: SimulationConfig;
}

// ─── Snapshot (output of calc engine) ──────────────────

export interface StatSourceEntry {
  sourceType: string;
  sourceId: string;
  sourceName: string;
  operation: string;
  value: number;
}

export interface StatBreakdown {
  statId: StatId;
  base: number;
  added: number;
  increased: number;
  more: number;
  final: number;
  sources: StatSourceEntry[];
}

export interface OffensiveSummary {
  averageHit: number;
  critChance: number;
  critMultiplier: number;
  castSpeed: number;
  attackSpeed: number;
  expectedDps: number;
  spellDamage: number;
  increasedSpellDamage: number;
  increasedElementalDamage: number;
}

export interface DefensiveSummary {
  health: number;
  ward: number;
  armor: number;
  armorDamageReduction: number;
  dodgeRating: number;
  dodgeChance: number;
  blockChance: number;
  blockEffectiveness: number;
  blockDamageReduction: number;
  glancingBlowChance: number;
  glancingBlowDamageReduction: number;
  endurance: number;
  enduranceThreshold: number;
  lessDamageTaken: number;
  fireResistance: number;
  coldResistance: number;
  lightningResistance: number;
  necroticResistance: number;
  voidResistance: number;
  poisonResistance: number;
  effectiveHealth: number;
}

export interface SustainSummary {
  mana: number;
  manaRegen: number;
  manaCostPerSecond?: number;
  manaNetPerSecond?: number;
  timeToOomSeconds?: number;
  skillUsesPerSecond?: number;
  effectiveSkillCooldown?: number;
  healthLeechPerSecond?: number;
  wardPerSecond?: number;
  wardGainedPerSecond?: number;
  totalWardPerSecond?: number;
  healthRegen: number;
  wardRetention: number;
  movementSpeed: number;
}

export interface BuildSnapshot {
  stats: Record<string, number>;
  offensive: OffensiveSummary;
  defensive: DefensiveSummary;
  sustain: SustainSummary;
  breakdowns: StatBreakdown[];
}
