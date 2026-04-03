# Last Building

Last Building is a deterministic build planner and simulator for **Last Epoch**.

It is built to do more than layout planning: it computes a full stat snapshot, explains where each value comes from, and previews deltas before committing changes.

## What the app does

### Planner workflow

- Pick class and mastery.
- Allocate passive tree nodes.
- Specialize skills and assign skill nodes.
- Equip items, add affixes, and apply unique effects.
- Place idols on the altar grid.
- Inspect live totals and source breakdowns in the calculations panel.

### Feature highlights

- **Interactive passive trees** with pan/zoom, progression cues, and dedicated Weaver ornament tab.
- **Interactive skill trees** with drag-to-pan editing.
- **Equipment editor** with implicits, affixes, uniques, and detailed hover tooltips.
- **Unique item toggles** for configuring conditional unique effects per item.
- **Idol editor** with altar-aware slot restrictions, multi-cell placement, refracted slot buffing, and hover tooltips.
- **Blessings** support with equipable blessing modifiers and Maxroll import.
- **Real-time stat recomputation** on every build mutation.
- **Delta preview** for proposed changes before applying them.
- **Source explainability** that shows which passive/skill/item/idol/base source modified each stat.
- **Resistance color coding** with per-element colors in stat panels (fire, cold, lightning, necrotic, void, poison, physical).
- **Combat simulation config** with enemy conditions (shocked, chilled, ignited, etc.), armor shred stacks, player conditions (at full health, has ward, recently used potion, etc.), and minion count.
- **Custom modifiers** for manually adding arbitrary stat buffs to test scenarios.
- **Ward sustain calculations** estimating ward gained per second from generation and retention.
- **Build sharing** via file, dpaste.com links (30-day expiry), or clipboard copy/paste.
- **Build persistence** with save/load, versioned format, and forward migration.
- **Maxroll import** for passives, skills, equipment, idols, blessings, and compatible extra modifiers.
- **Desktop packaging** with Tauri and NSIS installer output.

## Calculations and simulation model

The calculation engine (`packages/calc-engine`) is pure TypeScript and deterministic.

### 1) Collect active modifiers

Modifiers are collected from:

- class base stats and mastery bonus stats
- passive node allocations (including weaver ornament nodes)
- specialized skill node allocations
- item base implicits
- affix rolls (including multi-property affixes)
- unique effects (with configurable toggles per unique)
- blessing modifiers
- idol modifiers and imported extra modifiers
- custom user-defined modifiers
- conditional modifiers filtered by active toggles (enemy/player state)

Key file: `packages/calc-engine/src/collect-modifiers.ts`

### 2) Aggregate by target stat and operation

All modifiers are grouped per stat and operation bucket:

- `add`
- `increased`
- `more`
- optional `set`
- optional `override`

Key file: `packages/calc-engine/src/aggregate.ts`

### 3) Resolve stats through a fixed operation order

For each stat, resolution follows the same sequence:

1. `base` from `set` or `0`
2. additive layer: `base + sum(add)`
3. increased/decreased layer: `* (1 + sum(increased)/100)`
4. more/less layer: `* product(1 + more/100)`
5. `override` replaces final result if present

This predictable order is what keeps comparisons and previews reliable.

Key file: `packages/calc-engine/src/resolve-stats.ts`

### 4) Compute derived combat and survivability metrics

Derived formulas then compute high-level outputs such as:

- `average_hit`
- `expected_dps`
- `effective_health` (with ward integration)
- speed/multiplier factors (attack, cast, hit count)
- enemy mitigation interactions (enemy level DR, resistance, penetration, shred, damage taken)
- ward sustain metrics (`ward_gained_per_second`, `total_ward_per_second`)

When an active skill is selected, skill baseline data (base damage, base hits/sec, speed type, effectiveness) is included in derived calculations.

Key file: `packages/calc-engine/src/derived.ts`

### 5) Build immutable snapshots with explainable sources

Final output includes:

- flat stat map (`stats`)
- grouped summaries (`offensive`, `defensive`, `sustain`)
- per-stat breakdown rows with source metadata for UI explainability

Key file: `packages/calc-engine/src/snapshot.ts`

## Monorepo architecture

- `apps/planner-web` - React UI and Tauri shell
- `packages/build-model` - shared build/domain types and factories
- `packages/calc-engine` - deterministic stat pipeline
- `packages/game-data` - adapters, normalization, stat mappings, display helpers
- `packages/rules-engine` - validation and prerequisites
- `packages/serialization` - save/load and compatibility format helpers
- `packages/test-fixtures` - reusable fixtures and golden test data

## Tech stack

| Layer    | Tech                             |
| -------- | -------------------------------- |
| UI       | React 19, Vite 6, Tailwind CSS 3 |
| State    | Zustand 5                        |
| Desktop  | Tauri v2 (Rust)                  |
| Tests    | Vitest 3                         |
| Monorepo | pnpm workspaces                  |

## Getting started

### Prerequisites

- Node.js >= 20
- pnpm >= 9
- Rust toolchain (desktop build only)

### Install and run

```bash
pnpm install
pnpm dev
```

### Quality checks

```bash
pnpm lint
pnpm format:check
pnpm test
```

### Build desktop installer

```bash
pnpm build:installer
```

Installer output is generated under:

`apps/planner-web/src-tauri/target/release/bundle/`

## License

This project is for personal/educational use. Game data belongs to Eleventh Hour Games.
