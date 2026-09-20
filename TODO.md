# vb-stats - TODO

## Features

- [ ] Team localisation to compute distance for each competition days
- [x] Set more weight on last match edges.
- [ ] sheets:
  - stats for each players:
    - serve series,
    - sheets, selections, starts, replacements, full (per match, per set)
    - percentage of matchs, sets, points
    - impact always relative to team average (team without player?)
    - scale from underrated to overrated (-5% -> +5%) relative to %age of played points
    - positions and %age per roles, impact per positions
      note: simplify, when a player played everything?

## Technical

- [x] PWA
- [x] stylelint for properties order
- [x] eslint-plugin-import
- [ ] Issue: sorting on previous day is broken

## Dependencies

Blocked upstream, recheck periodically:

- [ ] TypeScript 7 — `typescript-eslint` refuses TS 7.0 outright ("does not support TS 7.0"), and
      upstream targets TS >=7.1: https://github.com/typescript-eslint/typescript-eslint/issues/10940.
      `tsconfig.json` is already forward-ported, so the only other move needed is the bump itself.
      Note `typescript@7` _is_ the native Go port; `@typescript/native-preview` is superseded.
      Workaround if it gets urgent: keep `typescript` at 6.0.3 for the lint toolchain and add
      `typescript7: npm:typescript@7.0.2` for the build (verified working, but two compilers).
- [ ] ESLint 10 (and `@eslint/js` 10) — `eslint-plugin-react@7.37.5` crashes on it
      (`context.getFilename is not a function`, removed in ESLint 9); `eslint-plugin-import` and
      `eslint-plugin-jsx-a11y` also still cap at `^9`. ESLint 9 is npm-deprecated, so this one has a
      clock on it.

## Cleanup

- [ ] Drop `recharts` — unused; its only import (`CompetitionSheets.tsx`) is commented out
- [ ] Decide on the unwired views: `CompetitionSheets.tsx` and `CompetitionSheetsOld.tsx` have no
      importers at all; `CompetitionTeams.tsx` is only reached through a `// TODO hack` stylesheet
      import in `CompetitionPools.tsx`
- [ ] `CompetitionSheetsOld.tsx` passes `filterOption` at the top level of `Select`, deprecated in
      antd 6 (moves under `showSearch`)
- [ ] Add `engines` (Node >=20.19, required by `@vite-pwa/assets-generator` 2) and `browserslist`,
      so build targets are declared rather than implied
- [ ] Graph tab has a 3px page scroll from the inline-SVG baseline gap (`display: block` on the svg)
- [ ] `useScrollDirection` no longer uses react-use; check whether `react-use` still earns its place
      (only `useWindowSize` in `Shell.tsx` remains)

Deliberately not done:

- `stylelint-config-prettier-scss` looks vestigial but is not: `stylelint --print-config` shows it
  still disables 15 active SCSS whitespace rules from `stylelint-config-standard-scss` 17 that
  conflict with Prettier. Leave it.
