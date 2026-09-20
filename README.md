# vb-stats — Volleyball Stats

A React + TypeScript + Vite PWA that explores French youth volleyball (FFVB) competition statistics:
pool standings, TrueSkill ratings, win probabilities, and team relationship graphs — mainly for the
Coupe de France youth categories.

Live app: [gillesdandrea.github.io/vb-stats](https://gillesdandrea.github.io/vb-stats)

## Getting started

```shell
pnpm install
pnpm dev
```

Competition data lives as CSV files in `public/data/` and is parsed in the browser, so no backend is
needed.

## Common commands

| Command                       | What it does                                  |
| ----------------------------- | --------------------------------------------- |
| `pnpm dev`                    | Vite dev server                               |
| `pnpm build`                  | TypeScript check + production build           |
| `pnpm lint` / `pnpm lint:fix` | Prettier, ESLint and Stylelint                |
| `pnpm deploy`                 | Publish `dist/` to GitHub Pages               |
| `pnpm cdf-scrap`              | Scrape fresh FFVB results into `public/data/` |
| `pnpm cdf-update`             | Scrape → build → deploy                       |

## Documentation

- [AGENTS.md](AGENTS.md) — architecture, code organization and conventions
- [README-SHEETS.md](README-SHEETS.md) — match sheet (player statistics) workflow
- [docs/](docs/) — how the FFVB assembles pools, and the pool prediction algorithm specification
