# Last Building

A build planner for **Last Epoch** — plan passives, skills, and equipment in one place with real-time stat calculations and delta analysis.

## Features

- **Class & Mastery selection** — all 5 base classes and 15 masteries
- **Passive tree** — interactive SVG trees with pan/zoom, progress bars, and point tracking
- **Skill trees** — allocate skill nodes with drag-to-pan navigation
- **Equipment** — select items per slot and apply affixes
- **Idol grid** — place idols on the altar
- **Stat engine** — derived stats update instantly on every change
- **Delta analysis** — hover a node or affix to see the impact before committing
- **Build management** — save, load, and compare multiple builds (local storage)
- **Maxroll import** — import builds from Maxroll planner URLs
- **Desktop app** — Windows installer via Tauri

## Tech Stack

| Layer    | Tech                             |
| -------- | -------------------------------- |
| UI       | React 19, Vite 6, Tailwind CSS 3 |
| State    | Zustand 5                        |
| Desktop  | Tauri v2 (Rust)                  |
| Tests    | Vitest 3                         |
| Monorepo | pnpm workspaces                  |

## Project Structure

```
apps/
  planner-web/         # React frontend + Tauri desktop shell
packages/
  build-model/         # Build data types and factory functions
  calc-engine/         # Stat computation and modifier collection
  game-data/           # Game data types, import adapters, stat mapping
  rules-engine/        # Allocation validation and prerequisite checks
  serialization/       # Build import/export (JSON, Maxroll format)
  test-fixtures/       # Shared test data
```

## Getting Started

### Prerequisites

- **Node.js** ≥ 20
- **pnpm** ≥ 9
- **Rust** toolchain (only for the desktop app)

### Install & Run

```bash
pnpm install
pnpm dev          # Start the web dev server at http://localhost:1420
```

### Test

```bash
pnpm test         # Run all tests
pnpm test:watch   # Watch mode
```

### Build Desktop Installer

```bash
pnpm build:installer   # Produces a Windows NSIS installer in apps/planner-web/src-tauri/target/release/bundle/
```

## License

This project is for personal/educational use. Game data belongs to Eleventh Hour Games.
