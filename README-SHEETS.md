# Analysing match sheets

```Shell
pnpm vb-scrap 2025 LICA pool PMA
pnpm pdf-parse 2025 LICA PMA CANNES
pnpm dev
open "http://localhost:5173/vb-stats?tab=sheets&season=2024/2025&entity=LICA&category=PMA&day=last&singleDay=false&qualified=true"
```
