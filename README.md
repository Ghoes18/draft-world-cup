# 7a0 engine + timeline

Server-authoritative, pure-function **match engine** and **event-timeline generator** for **7a0** ("Sete a Zero") — the existing live web game. This repository implements the core simulation stack described in the product docs; presentation integrates into the main **Next.js** app as **text-only** simulation (Fast ticker + Ultra Fast instant), not as a standalone demo here.

## Documentation map

| Document | Audience | Purpose |
| -------- | -------- | ------- |
| **[README.md](./README.md)** (this file) | Developers | Repo layout, commands, milestone status |
| **[MVP.md](./MVP.md)** | Product / eng | **Source of truth for what to build first** (M1–M6) |
| **[PRD.md](./PRD.md)** | Product / eng | Long-term vision (ELO, brackets) — mostly post-MVP |
| **[CLAUDE.md](./CLAUDE.md)** | AI agents / contributors | Architecture rules, engine constants, integration notes |
| **[GAME-GUIDE-AND-RULES.md](./GAME-GUIDE-AND-RULES.md)** | Players | Plain-language rules; cross-check for engine behaviour and badges |

When **MVP.md** and **PRD.md** disagree on scope, **MVP.md wins** for current work.

## Architecture

Three decoupled layers, in strict order:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / Ultra Fast)
```

1. **Engine** — Poisson model decides the *final score* (and penalties for knockout draws). Pure numbers; no rendering.
2. **Timeline** — deterministic, serialisable match events generated *from* the already-decided score + seed. The final event always reconciles to the engine score.
3. **Presentation** — Fast text ticker and Ultra Fast instant result. Both are consumers of the same timeline.

**This is not FIFA or Football Manager.** The result exists first; Fast mode is a **scripted text replay** of that result. Cosmetic filler (passes, shots, corners) must never change the score.

**Explicitly out of scope in this repo:**

- **Live physics / player AI** that decides goals during play
- **Animated match views** (2D, 3D, canvas, video)
- **Standalone browser demo** (no Vite harness; verify via CLI + tests)
- **Client-authoritative** outcomes for online or daily challenge

## Milestone status

| Milestone | Status | In this repo |
| --------- | ------ | ------------ |
| **M1** Engine + timeline | ✅ Done | `src/engine.ts`, `src/timeline/`, `src/consumers/fastText.ts`, `src/cli/simulate.ts` |
| **M2** Chemistry + tactics | ✅ Done | `src/chemistry.ts`, `src/strength.ts`; CLI `--tactic`/`--chem`; Build panel in `apps/web` |
| **M3** Match statistics | ✅ Done | `src/consumers/stats.ts` (`computeMatchStats`); stats block in `pnpm sim`; StatsPanel in `apps/web` |
| **M4–M6** Online, highlights, daily | ⏳ Deferred | See [MVP.md](./MVP.md) |

Public npm-style export (`src/index.ts`) is **engine + timeline + Fast text + stats only** — server-safe, no canvas/DOM.

## Repository layout

```
src/
  engine.ts          # Poisson match engine + penalties
  poisson.ts         # Knuth sampler
  rng.ts             # mulberry32
  constants.ts       # Engine + timeline tuning knobs
  types.ts           # MatchTimeline schema (PRD §7.3)
  catalog.ts         # Squad catalog + PlayerCard.force
  catalog/liveImport.ts  # 7a0 squad JSON decode + normalize
  catalog/fjelstulImport.ts  # Fjelstul CSV → full World Cup catalog
  cli/build-catalog.ts   # Download Fjelstul + build data/catalog.json
  lineupStrength.ts  # lineupToTeamStrength — derive attack/def/def/overall from XI
  positions.ts       # 7a0 position weights
  roll.ts            # Turn-based draft roll + global rerolls
  demoCatalog.ts     # Demo squads with autoral forces
  cli/import-squads.ts   # Batch import squad JSON → catalog
  timeline/          # generate.ts, filler, minutes, clusters
  consumers/         # fastText.ts — Fast tier / accessibility path; stats.ts — match statistics
  cli/simulate.ts    # Terminal match runner
test/                # vitest — engine, timeline, RNG, Poisson
apps/web/            # Next.js text match viewer (Fast + Ultra Fast)
```

## Commands

```bash
pnpm install
pnpm test            # vitest — engine, RNG, Poisson, timeline reconciliation
pnpm typecheck       # tsc --noEmit
pnpm build           # tsc emit to dist/

# Run a match as Fast text in the terminal:
pnpm sim --home 91 --away 76 --seed demo123
pnpm sim --home 84 --phase final --seed cup-run-7   # campaign phase + knockout
pnpm sim --home 88 --away 76 --tactic offensive --chem 80 --seed demo  # M2 build

# Import squad JSON (live format or autoral) into a normalized catalog:
pnpm import:squads --dir ./squads --out ./data/catalog.json

# Build full men's World Cup catalog (1930–2022) from Fjelstul open data:
pnpm build:catalog
# Options: --from 1950 --to 2022 --cache ./data/fjelstul --out ./data/catalog.json

# Overlay pipeline (heuristic base < Wikimedia photos < external CSV < curated JSON):
pnpm import:photos --overlay ./data/catalog.json
pnpm import:external --csv ./data/external-ratings.csv --overlay ./data/catalog.json
pnpm import:squads --dir ./squads/curated --overlay ./data/catalog.json
```

Forces from `build:catalog` are **autoral** (derived from appearances + goals in the Fjelstul database). They are not live 7a0 ratings. Replace with licensed `{ sel, copa, squad, f }` JSON via `import:squads` when available. See [data/fjelstul/ATTRIBUTION.md](./data/fjelstul/ATTRIBUTION.md).

`--phase` accepts `group1|group2|group3|r16|qf|sf|final` and sets opponent overall (68/72/76/79/83/87/91) and the knockout flag.

`--tactic` (`offensive|balanced|defensive`) and `--chem` (0–100, chemistry %) apply the M2 chemistry + tactics modifiers to the **home** side via `effectiveStrength`; the printed effective ratings and λ shift accordingly.

## Integration with the live game

The production app is **Next.js (App Router)**, auth via **better-auth**, i18n **PT / EN / ES**. Reuse existing API routes:

- `/api/match/record` — results
- `/api/shorten` — invite / highlight / daily links
- `/api/metric` — telemetry
- `/api/auth` — sessions

For online (M4) and daily (M6): **Convex** — reactive queries/subscriptions for rooms and presence, plus mutations/actions for authoritative engine + timeline (see MVP §4.2, PRD §9.5).

## Calibration

Values not fixed by the live game (goal-minute distribution, filler density) live in [`src/constants.ts`](./src/constants.ts). Open product decisions: [MVP.md §9](./MVP.md), [PRD.md §15](./PRD.md).
