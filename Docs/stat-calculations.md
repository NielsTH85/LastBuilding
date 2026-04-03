# Stat Calculation Pipeline

## Overview

The calculation engine follows a deterministic 5-stage pipeline:

```
Collect Modifiers → Aggregate → Resolve → Derive → Snapshot
```

Every change to the build (allocating a passive, equipping an item, toggling a config option)
re-runs this entire pipeline to produce a fresh `BuildSnapshot`.

---

## Stage 1: Collect Modifiers

All active modifiers are gathered from the build in this order:

| #   | Source               | Details                                                           |
| --- | -------------------- | ----------------------------------------------------------------- |
| 1   | **Base class stats** | Flat stats from class definition (health, mana, attributes, etc.) |
| 2   | **Mastery bonuses**  | Optional bonus stats from selected mastery                        |
| 3   | **Passive nodes**    | Modifier × allocated points per node                              |
| 4   | **Skill nodes**      | All allocated skill trees (not just the active skill)             |
| 5   | **Equipment**        | Base implicits + affixes + unique effects for all slots           |
| 6   | **Idols**            | Idol implicit modifiers + user-added affix rolls                  |
| 7   | **Extra modifiers**  | Imported data (e.g. from Maxroll), and custom config modifiers    |
| 8   | **Blessings**        | Blessing modifiers from equipped blessings                        |

After all modifiers are collected, they are **filtered by conditions**. Any modifier with
a `conditions` array must have all conditions satisfied:

| Condition Type  | Evaluation                                                   |
| --------------- | ------------------------------------------------------------ |
| `toggle`        | Checks if `ToggleState` with matching id is `active: true`   |
| `skill_tag`     | True if any allocated skill has the specified tag            |
| `weapon_type`   | True if any equipped weapon has the matching type tag        |
| `damage_type`   | Always passes (handled at derived stage)                     |
| `min_attribute` | Always passes (conservative; threshold checks at resolution) |

### Multi-property affixes

When an affix has additional properties (e.g. "+health and +health regen"), a single roll
is projected across all properties proportionally:

```
rollRatio = (value - minValue) / (maxValue - minValue)
extraValue = extraMin + rollRatio × (extraMax - extraMin)
```

### What is NOT collected

- No major collection gaps currently tracked for idol altar effects in this model.

---

## Stage 2: Aggregate

All modifiers are grouped by `(targetStat, operation)`:

- `add` modifiers → summed into flat additions
- `increased` modifiers → summed into a single percentage
- `more` modifiers → each applied multiplicatively
- `set` → overrides the base value (last one wins)
- `override` → forces the final value, bypassing all math

---

## Stage 3: Resolve

For each stat, the final value is computed:

```
base       = set_value or 0
added      = Σ flat add modifiers
increased  = Σ increased% modifiers (additive with each other)
more       = Π (1 + each_more_value / 100)

final = (base + added) × (1 + increased / 100) × more
```

If an `override` modifier exists, it replaces the final value entirely.

Each resolved stat carries a full source breakdown for the UI.

---

## Stage 4: Derive

Derived stats are computed from the resolved stat map. These are stats whose value depends
on other stats (e.g. DPS depends on damage, speed, crit, etc.).

### Health

```
level_health = max(level - 1, 0) × 12
health = (base_health + flat_health + (vitality × 10) + level_health)
         × (1 + increased_health / 100)
         × (1 + more_health / 100)
```

### Defensive Stats

```
armor_damage_reduction = armor / (armor + 1400) × 100     [capped at 85%]
dodge_chance = dodgeRating / (dodgeRating + 700) × 100     [capped at 85%]
block_damage_reduction = blockChance% × blockEffectiveness%
glancing_blow_dr = glancingBlowChance% × 35%
total_less_damage_taken = less_damage_taken stat           [capped at 100%]
```

### Effective Health

```
rawPool = health + ward

survivalMultiplier =
    1/(1 − dodgeChance) ×        # dodge avoidance
    1/(1 − armorDR × 0.5) ×      # armor (weighted 50%, not all damage is physical)
    1/(1 − avgBlockDR) ×          # block average prevention
    1/(1 − avgGlancingDR) ×       # glancing blow average
    1/(1 − lessDR) ×              # less damage taken
    1/(1 − enduranceDR)           # endurance (thresholdPct × 60%)

effective_health = rawPool × survivalMultiplier
```

### Average Hit

```
baseDamage = skill_base + (added_damage × effectiveness)
           — or if no active skill: max(flat_damage_stats, 100)

totalIncreased = Σ all applicable increased_*_damage stats
               + generic global increased damage bonuses
               + (intelligence × 4)  [if cast-type skill]

afterIncreased = baseDamage × (1 + totalIncreased / 100)

moreDamage = more_damage + generic global more damage bonuses
afterMore = afterIncreased × (1 + moreDamage / 100)

critChance = min(crit_chance + base_crit_chance + bonuses, 100) / 100
critMulti  = (crit_multiplier + bonuses) / 100

average_hit = afterMore × (1 + critChance × (critMulti − 1))
            × skillHitMultiplier     [if active skill]
```

### Skill Hit Multiplier

Includes chain bonus and all conditional vs-ailment damage:

```
chainBonus = chains × (damage_per_chain% / 100) × (1 − less_per_chain% / 100)

vsShocked  = hit_damage_against_shocked%    [only if enemy is Shocked]
vsChilled  = hit_damage_against_chilled%    [only if enemy is Chilled]
vsIgnited  = hit_damage_against_ignited%    [only if enemy is Ignited]
vsPoisoned = hit_damage_against_poisoned%   [only if enemy is Poisoned]
vsBleeding = hit_damage_against_bleeding%   [only if enemy is Bleeding]
vsSlowed   = hit_damage_against_slowed%     [only if enemy is Slowed]
vsStunned  = hit_damage_against_stunned%    [only if enemy is Stunned]
atFullHealth = hit_damage_at_full_health%   [only if player at full health]
hasWard    = hit_damage_with_ward%          [only if player has ward]

multiplier = (1 + chainBonus) × Π(1 + each_bonus)
```

### Expected DPS

```
expected_dps = average_hit
             × speedFactor
             × castFactor
             × hitCountFactor
             × penetrationFactor
             × targetTakenFactor
             × resistanceFactor
             × increasedDamageTakenFactor
             × enemyMitigationFactor
```

#### Speed Factor

```
baseHitsPerSecond = skill baseline (or 1/0.13 for channelled Lightning Blast)
speedBonus = attack_speed or cast_speed depending on skill type
           + (intelligence / 2) × cast_speed_per_2_intelligence  [for cast skills]

speedFactor = baseHitsPerSecond × (1 + speedBonus / 100)
```

#### Cast Factor

```
castFactor = max(1, 1 + doublecast% + triplecast% × 2 + quadruplecast% × 3)
```

#### Hit Count Factor

```
chains = base_chains + maximum_additional_chains + per_recent_cast_chains × 2
       × 0.5 if half_maximum_chains

hitsPerCast = 1 + chains
            × 1.5 if lightning_blast_can_fork_or_chain
            ÷ casts_between_chaining if channelled

hitCountFactor = max(1, hitsPerCast)
```

#### Penetration Factor

```
totalPen = penetration + penetration_elemental + type_specific_penetration
         + lightning_res_penetration

appliedPen = min(totalPen, maximum_lightning_penetration) if cap exists

penetrationFactor = max(0.1, 1 + appliedPen / 100)
```

#### Target Taken Factor

Multiplicative factor from all enemy ailment conditions. Each ailment contributes
independently when its toggle is enabled in configuration:

```
For each ailment (shocked, chilled, ignited, poisoned, bleeding, slowed, stunned, boss):
  increased = damage_to_[ailment] + type_specific_to_[ailment]
  more      = more_damage_against_[ailment]
  factor   *= (1 + increased / 100) × (1 + more / 100)
```

Shocked has additional type-specific stats:
`lightning_damage_to_shocked_enemies` and `spell_damage_to_shocked_enemies`.

#### Resistance Factor

1. Auto-detect dominant damage type (fire/cold/lightning/physical/void/necrotic/poison)
   based on which type has the highest sum of added + increased + penetration stats.
2. Use the enemy's configured resistance for that type.
3. Subtract penetration and shred.

```
finalResistance = configResistance − penetration − shred
resistanceFactor = max(0.1, 1 − finalResistance / 100)
```

#### Increased Damage Taken Factor

Sums generic and type-specific enemy "increased damage taken" stats:

```
generic = increased_damage_taken + enemy_damage_taken
typeSpecific = [type]_damage_taken + increased_[type]_damage_taken

factor = 1 + max(0, generic + typeSpecific) / 100
```

#### Enemy Mitigation Factor

Level-based flat damage reduction, reduced by armor shred stacks:

```
baseDR = 87% × (enemyLevel / 100)
dr = clamp(baseDR − armorShredStacks, 0, 95)
factor = 1 − dr / 100
```

At enemy level 100 with 0 shred: 0.13 multiplier (87% DR).
With 20 armor shred stacks: 0.33 multiplier (67% DR).

---

## Stage 5: Snapshot

The snapshot packages everything into a structured output:

| Summary        | Fields                                                                                                                                                                                                                                                          |
| -------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Offensive**  | averageHit, critChance, critMultiplier, castSpeed, attackSpeed, expectedDps, spellDamage, increasedSpellDamage, increasedElementalDamage                                                                                                                        |
| **Defensive**  | health, ward, armor, armorDamageReduction, dodgeRating, dodgeChance, blockChance, blockEffectiveness, blockDamageReduction, glancingBlowChance, glancingBlowDamageReduction, endurance, enduranceThreshold, lessDamageTaken, all 6 resistances, effectiveHealth |
| **Sustain**    | mana, manaRegen, healthRegen, wardRetention, movementSpeed                                                                                                                                                                                                      |
| **Stats map**  | Every resolved stat's final value (including DPS factor breakdowns)                                                                                                                                                                                             |
| **Breakdowns** | Per-stat source attribution with sourceType, sourceId, sourceName, operation, value                                                                                                                                                                             |

---

## Configuration Panel

The Configuration tab exposes settings that affect calculations:

### Actively Used

| Setting                      | Effect                                                      |
| ---------------------------- | ----------------------------------------------------------- |
| **Enemy Level**              | Controls enemy level-based DR (87% at 100)                  |
| **Enemy Resistances**        | Per damage type, affects resistance factor in DPS           |
| **Enemy is Shocked**         | Enables vs-shocked hit bonuses + target taken multiplier    |
| **Enemy is Chilled**         | Enables vs-chilled hit bonuses + target taken multiplier    |
| **Enemy is Ignited**         | Enables vs-ignited hit bonuses + target taken multiplier    |
| **Enemy is Poisoned**        | Enables vs-poisoned hit bonuses + target taken multiplier   |
| **Enemy is Bleeding**        | Enables vs-bleeding hit bonuses + target taken multiplier   |
| **Enemy is Slowed**          | Enables vs-slowed hit bonuses + target taken multiplier     |
| **Enemy is Stunned**         | Enables vs-stunned hit bonuses + target taken multiplier    |
| **Enemy is Boss**            | Enables vs-boss damage bonuses + target taken multiplier    |
| **Enemy Armor Shred Stacks** | Reduces enemy level-based DR (1% per stack)                 |
| **Player at Full Health**    | Enables conditional hit_damage_at_full_health bonus         |
| **Player has Ward**          | Enables conditional hit_damage_with_ward bonus              |
| **Custom Modifiers**         | Injected as flat/increased/more modifiers into the pipeline |

### Defined But Not Yet Wired

| Setting                     | Status                                           |
| --------------------------- | ------------------------------------------------ |
| Player recently used Potion | UI exists, no conditional stats reference it yet |
| Player recently killed      | UI exists, no conditional stats reference it yet |
| Player recently been hit    | UI exists, no conditional stats reference it yet |
| Minion count                | UI exists, no minion mechanics implemented       |

---

## What Is Included

- ✅ Full modifier pipeline (add / increased / more / set / override)
- ✅ All 5 attribute stats
- ✅ Full DPS model with 8 multiplicative factors
- ✅ Crit chance and crit multiplier
- ✅ Attack speed and cast speed (with intelligence scaling)
- ✅ Multi-cast (double/triple/quadruple cast chance)
- ✅ Penetration (generic, elemental, type-specific, with caps)
- ✅ Resistance shred
- ✅ Enemy resistance per damage type
- ✅ Enemy level-based DR (with armor shred stack reduction)
- ✅ Auto-detection of dominant damage type
- ✅ All 7 enemy ailment conditions (shocked/chilled/ignited/poisoned/bleeding/slowed/stunned)
- ✅ Boss-specific damage bonuses
- ✅ Player combat state: full health and ward hit bonuses
- ✅ Condition evaluation (toggle, skill_tag, weapon_type filtering)
- ✅ Blessing modifier collection
- ✅ Chain and fork mechanics (with half-chain, less-per-chain modifiers)
- ✅ Channelled skill mechanics (Lightning Blast specific)
- ✅ Multi-property affix resolution
- ✅ Unique item effects
- ✅ Idol implicit and affix modifiers
- ✅ Item seals (sealed affixes are collected and resolved like normal affixes)
- ✅ Idol altar effects (implemented for refracted-slot scaling, per-idol stat bonuses, and layout-gated cooldown recovery)
- ✅ Source breakdowns for every stat
- ✅ Delta previews (hover a passive node to see stat changes)
- ✅ Custom modifier injection from config
- ✅ Armor → physical damage reduction (armor / (armor + 1400))
- ✅ Dodge rating → dodge chance (dodgeRating / (dodgeRating + 700))
- ✅ Block mechanics (chance × effectiveness = average DR)
- ✅ Glancing blow (chance × 35% base reduction)
- ✅ Less damage taken (multiplicative DR)
- ✅ Endurance (threshold-based 60% DR approximation)
- ✅ Effective Health calculation (accounts for all defensive layers)
- ✅ Level requirement warnings on equipped gear (UI highlights items above character level)
- ✅ Mana sustainability metrics (mana cost/sec, net mana/sec, time-to-OOM)
- ✅ Cooldown recovery speed usage (effective skill cooldown derived stat)
- ✅ Player recently used Potion / killed / been hit toggle conditions are now evaluated via config fallbacks
- ✅ Health leech sustain estimate (derived leech-per-second from DPS × leech%)
- ✅ Ward sustain estimate (derived ward-per-second from ward generation and retention)
- ✅ Throwing damage scaling in generic hit model (flat throwing + increased throwing now contribute)
- ✅ Throwing skill-specific behavior (throwing stats now apply via active skill tags instead of being treated as generic for all skills)
- ✅ Exact ailment DoT simulation (steady-state stack/tick model for ignite/bleed/poison)
- ✅ Exact area simulation (deterministic area-tagged coverage model with nearby-target cap)
- ✅ Exact minion damage simulation (deterministic minion hit/speed/crit/mitigation model with configured minion count)
- ✅ Idol altar slot-limit and weaver/refracted effect handling (category caps and refracted idol scaling)

## What Is Not Included

- No major “not included” items are currently tracked in this document.
  Use https://maxroll.gg/last-epoch/resources/damage-explained for damage explenation.

## Hardcoded Skill Logic

The DPS model contains Lightning Blast-specific behavior:

- `lightning_blast_is_channelled` — overrides base hits/sec to 1/0.13 and adjusts chain calculation
- `lightning_blast_can_fork_or_chain` — multiplies hit count by 1.5

These are not generic mechanics and would need to be generalized for other skills.
