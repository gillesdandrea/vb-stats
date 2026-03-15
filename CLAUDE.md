# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Key Principles

### Knowledge

When unfamiliar with a library or needing up-to-date information, use MCP tools before guessing:

- Use **context7 MCP** to access library documentation and code snippets
- Use **codewiki MCP** to ask natural language questions about code examples, best practices, or architecture

### Simplicity First

- Avoid over-engineering, keep solutions simple and focused
- **Single responsibility**: Each source file should have a clear, focused scope/purpose
- **Split large files**: Break files when they become large or handle too many concerns
- **Avoiding entropy**: This codebase will outlive you. Every shortcut becomes technical debt that slows the team down. The patterns you establish will be copied. Fight entropy. Leave the codebase better than you found it.

### Comments

- **Avoid unnecessary comments**: Code should be self-explanatory
- **Explain "why" not "how"**: Comments should describe the reasoning or intent, not what the code does

### TypeScript

- Use strict TypeScript for all code
- **Explicit return types**: Declare return types explicitly when possible
- **Avoid complex inline types**: Extract complex types into dedicated type or interface declarations
- **`any` type is completely prohibited**. Use alternatives by priority:
  1. **unknown Type + Type Guards**: For validating external input (API responses, localStorage, URL parameters)
  2. **Generics**: When type flexibility is needed
  3. **Union Types / Intersection Types**: Combinations of multiple types
  4. **Type Assertions (Last Resort)**: Only when type is certain
- Use modern type features:
  - **satisfies Operator**: `const config = { apiUrl: '/api' } satisfies Config` - Preserves inference
  - **const Assertion**: `const ROUTES = { HOME: '/' } as const satisfies Routes` - Immutable and type-safe

### Bugs and issues

- Don't guess, investigate systematically with the 5 whys method
- Fix the root cause, not the symptom

## Development Commands

Package manager: **pnpm** (pinned v9.15.0)

- `pnpm dev` — start Vite dev server
- `pnpm build` — TypeScript check + Vite production build
- `pnpm lint` — run all linters (prettier, eslint, stylelint) in parallel
- `pnpm lint:fix` — auto-fix all linting issues
- `pnpm preview` — preview production build
- `pnpm deploy` — deploy to GitHub Pages
- `pnpm cdf-scrap` / `pnpm vb-scrap` — scrape FFVB data
- `pnpm cdf-update` — full pipeline: scrape → build → deploy

## Architecture

- React 18 + TypeScript + Vite PWA, deployed to GitHub Pages at `/vb-stats`
- Domain: French youth volleyball (FFVB) competition statistics with TrueSkill ratings
- Data pipeline: CSV files in `public/data/` → PapaParse → `processCompetition()` → domain model
- UI: Ant Design dark theme, React Query for data fetching, URL params as state
- 4 main views: Pools, Board, Graph, Sheets (tab-based via Shell component)
- Key libraries: ts-trueskill (ratings), recharts (charts), d3-graphviz (network graphs)

## Code Organization

- `src/model/` — Domain types and business logic (the core of the app)
  - `model.ts`: Type definitions (Competition, Team, Match, Stats, Pool)
  - `model-process.ts`: CSV→domain transformation, match creation, rating updates
  - `model-helpers.ts`: Utility functions (rating, filtering, stats extraction)
  - `model-sorters.ts`: Multiple ranking strategies (points, rating, wins, sets, points)
  - `geography.ts`: French department/region data and color mapping
  - `graph.ts`: Graphviz DOT generation
  - `sheet.ts` / `sheet-helpers.ts`: Match sheet player-level statistics
  - `meta.ts`: Prediction accuracy tracking
- `src/app/` — Feature views (Shell + competition views)
- `src/components/` — Reusable UI components (Graphviz, TeamInfo, Trophies, etc.)
- `src/utils/` — React hooks (useCompetition)
- `src/scripts/` — Build-time data scrapers (cdf-scrap, vb-scrap, pdf-parse)

## Key Patterns

- Data flow: CSV → `useCompetition` hook (React Query) → `processCompetition()` → renders
- State: URL query params are source of truth (season, entity, category, day, tab)
- Ranking: TrueSkill-based win probability + traditional points-based ranking
- Domain types use `readonly` fields for immutability
- Import sorting: 8 groups enforced by ESLint (node → react → packages → local → styles)
- Path aliases: `@/*` maps to `src/*` (enforced by ESLint, no relative imports)
