# Last Building - Implementation Summary

## Purpose

This document summarizes how the planner is currently built:

- How game data is sourced
- How stats are calculated
- How maxroll import works
- How UI rendering works
- What techniques and guardrails are used

## Project Structure

Monorepo layout:

- apps/planner-web: React UI, Zustand store, component rendering
- packages/game-data: data adapters, normalization, display helpers, import conversion
- packages/build-model: build state types and immutable update helpers
- packages/calc-engine: deterministic modifier pipeline and snapshots
- packages/rules-engine: validation logic
- packages/serialization: save/load format handling
- packages/test-fixtures: fixture and golden test support

## Data Source Priority

Source of truth policy:

- Primary game content source: C:\ledata (Last Epoch local game files)
- Maxroll usage: build/profile import mapping and compatibility, not authoritative game content

Current extraction status:

- Uniques are extracted from game binary data (UniqueList in resources.assets)
- Tooltip text and hidden/complex unique mod metadata come from game data extraction
- Affixes and skill trees currently flow through imported normalized JSON datasets used by adapters

## Core Techniques

Engineering approach:

- Deterministic stat computation (same input => same output)
- Data-driven adapters and mapping layers
- Immutable build state updates
- Central modifier model for all systems (passives, skills, gear, uniques)
- Snapshot + delta comparisons for previews
- Regression tests for each major data/logic fix

## How Stat Calculation Works

Main pipeline in calc-engine:

1. Collect active modifiers from base stats, passives, skills, item implicits, affixes, unique effects.
2. Aggregate by target stat and operation.
3. Resolve each stat through operation order.
4. Compute derived/composite stats.
5. Build final snapshot and source breakdowns.

Operation order details:

- add: summed
- increased: summed percentage applied after additive base
- more: multiplicative layers
- set and override: special handling in resolver

Key files:

- packages/calc-engine/src/collect-modifiers.ts
- packages/calc-engine/src/aggregate.ts
- packages/calc-engine/src/resolve-stats.ts
- packages/calc-engine/src/derived.ts
- packages/calc-engine/src/snapshot.ts
- packages/calc-engine/src/compute.ts

## Affix Handling (Current State)

Affix conversion:

- Affixes are adapted from source JSON in equipment-adapter.
- All imported normal affixes are retained (no silent drops).
- Multi-property affixes are supported.

Multi-property technique:

- Primary roll comes from the selected affix roll value.
- Additional affix properties use per-tier extraRoll ranges.
- Collector projects the primary roll ratio into secondary ranges so all properties contribute.

Key files:

- packages/game-data/src/data/equipment-adapter.ts
- packages/calc-engine/src/collect-modifiers.ts

## Skill Handling (Current State)

Skill import:

- Skills are converted via maxroll-adapter into SkillDef trees.
- Coverage includes all skills present in source dataset.

Skill stat mapping:

- Known stats use explicit stat mapping.
- Unmapped skill stats now use normalized fallback stat IDs and still enter the modifier pipeline.
- Non-numeric skill effects are represented as binary flags so they are not dropped.

Skill ID compatibility:

- Alias handling keeps legacy IDs stable (example: IceBarrage canonicalized to glacier for compatibility).
- UI resolver handles exact and normalized ID matching.

Key files:

- packages/game-data/src/data/maxroll-adapter.ts
- packages/game-data/src/data/stat-mapping.ts
- apps/planner-web/src/components/SkillBar.tsx

## How Maxroll Import Works

Build import flow:

1. Parse maxroll URL/profile id.
2. Fetch profile payload.
3. Convert class and mastery indexes to internal IDs.
4. Replay passive history to node allocations.
5. Convert specialized skills and tree histories.
6. Convert equipment (base, affixes, uniques, rolls).
7. Produce ImportedBuild and load into planner store.

Important behavior:

- Unique name matching prefers stable unique identity.
- Unique effects are converted to modifiers through unique adapter conversion.

Key file:

- packages/game-data/src/data/maxroll-build-import.ts

## Unique Rendering and Display

Unique display strategy:

- Prefer game-authored tooltip descriptions.
- Normalize tokenized description templates into readable text.
- Filter hidden mods and suppress unsupported complex templates.
- Allowlist known complex templates with explicit renderers.

Result:

- Removed generic fallback gibberish lines from complex template properties.
- Added explicit handling for known tag templates (for example set-bonus style templates and specific unique-only templates).

Key files:

- packages/game-data/src/data/item-display.ts
- apps/planner-web/src/components/ItemEditor.tsx

## UI Rendering Overview

Primary planner UI:

- App shell with tabs: Passive Tree, Skills, Equipment
- Right-side stat panel always visible
- Skill trees rendered as graph nodes/edges with pan/zoom and tooltips
- Equipment panel renders implicits, affixes, and unique effects with ranges

State management:

- Single store tracks build, snapshot, active skill context, preview deltas
- Recompute is triggered on each state mutation for deterministic updates

Key files:

- apps/planner-web/src/App.tsx
- apps/planner-web/src/store/useBuildStore.ts
- apps/planner-web/src/components/PassiveTree.tsx
- apps/planner-web/src/components/SkillBar.tsx
- apps/planner-web/src/components/ItemEditor.tsx
- apps/planner-web/src/components/StatPanel.tsx

## Testing and Verification

Current practice:

- Add regression tests for each pipeline correction
- Validate adapter coverage counts against source data
- Run full workspace test suite after major data/model changes

Recent outcomes:

- Expanded passing tests as coverage was added for affix and skill adapter behavior
- Confirmed adapter and render-path fixes with targeted tests and full suite runs

## Current Limitations and Next Steps

Known limitations:

- Some complex template families still need explicit semantic renderers for perfect in-game wording.
- Some fallback-normalized skill stats are included for calculation visibility but may not yet be mapped to canonical derived behavior.

Recommended next steps:

- Continue template allowlist expansion for remaining complex unique tags.
- Add canonical mappings for high-frequency fallback skill stats.
- Move remaining imported datasets toward direct C:\ledata extraction where practical.
- Add automated coverage reports for unmapped stat names and template tags.
