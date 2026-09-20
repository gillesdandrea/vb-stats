# Analysing match sheets

```Shell
pnpm vb-scrap 2025 LICA pool PMA
pnpm pdf-parse 2025 LICA PMA CANNES
pnpm dev
open "http://localhost:5173/vb-stats?tab=sheets&season=2024/2025&entity=LICA&category=PMA&day=last&singleDay=false&qualified=true"
```

The sheets view is not wired into `src/app/Shell/Shell.tsx` — `CompetitionSheets` is neither imported
nor listed in `tabNames` — so the URL above renders nothing until it is hooked back up.
