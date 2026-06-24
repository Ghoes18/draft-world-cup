## Learned User Preferences

- Match simulation follows the original 7a0 model documented in **CLAUDE.md** / **GAME-GUIDE-AND-RULES.md §5.7**: engine (Poisson) decides the result first, then a deterministic timeline, then text presentation (Fast ticker + Ultra Fast instant). Not live physics/AI deciding goals.
- When implementing attached plans, do not edit the plan file itself; use the existing todos and mark them in progress as you work.
- Roll/build: one scenario roll per match *(national team, Cup)*; each turn pick one player from that squad; **5** global rerolls (7a0 uses 3 for 1950–2026; extra pool for 1930–1938 history).
- Player slot eligibility and displayed overall must use explicit `positions` and `overall` when present in catalog data (`positionSource: "api"`); do not treat coarse Fjelstul codes as strict API positions.
- FIFA draft-style formation picker with defensive/balanced/offensive variants that change slot positions, chosen before filling the XI.
- Player headshots and golden-name UI styling are for the fixed World Cup legend roster (`src/legends.ts`) only — not bulk Wikimedia photos for the full catalog.

## Learned Workspace Facts

- **Source of truth for docs:** README.md, CLAUDE.md, MVP.md, PRD.md, GAME-GUIDE-AND-RULES.md (see README documentation map). When MVP.md and PRD.md disagree, **MVP.md wins**.
- M1 complete (engine + timeline + Fast text). Presentation is text-only — no 2D render library. Verify with `pnpm typecheck`, `pnpm test`, `pnpm sim`.
- **MVP build order M1–M6** (no 2D renderer milestone); M1–M3 are complete, **M4 is in progress as a server-authoritative World Cup tournament** with Convex queue/batch resolution, and M5/M6 are not started.
- No standalone Vite/browser demo harness in this repo; text match viewer lives in `apps/web/`.
- `.cursor/` is gitignored; do not commit local Cursor hook/editor state.
- Catalog overlay pipeline (OVR, positions, optional photos; precedence: curated > external CSV > Zafronix > Wikimedia/Fjelstul heuristic): `pnpm build:catalog` → optional `pnpm import:zafronix --from 1930 --to 1969` → optional `pnpm import:photos --overlay` → optional `pnpm import:external --csv … --overlay` → optional `pnpm import:squads --dir ./squads/curated --overlay`.
- World Cup legend roster in `src/legends.ts`; runtime `applyLegendPhotosToCatalog` supplies headshots and golden-name styling for that list only (web app `prepareGameCatalog`).
- Fine FIFA positions and tuned overall require curated squad JSON or external CSV; Fjelstul base only provides coarse GK/DF/MF/FW with `positionSource: "inferred"`, and pre-1970 Fjelstul squads need Zafronix enrichment because `player_appearances.csv` has no rows before 1970.
- Only curated overlays may reach OVR 99; heuristic `deriveOverall` caps below curated peaks.
- **7a0 is design inspiration only** — there is no separate live 7a0 app/repo to fetch from; this project (`draft-world-cup`) is the game being built.
