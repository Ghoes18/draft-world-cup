# 7a0 engine + timeline

Server-authoritative, pure-function **match engine** and **event-timeline generator** for **7a0** ("Sete a Zero") — the existing live web game. This repository implements the core simulation stack described in the product docs; presentation integrates into the main **Next.js** app, not as a standalone demo here.

## Documentation map

| Document | Audience | Purpose |
| -------- | -------- | ------- |
| **[README.md](./README.md)** (this file) | Developers | Repo layout, commands, milestone status |
| **[MVP.md](./MVP.md)** | Product / eng | **Source of truth for what to build first** (M1–M7) |
| **[PRD.md](./PRD.md)** | Product / eng | Long-term vision (3D, ELO, brackets) — mostly post-MVP |
| **[CLAUDE.md](./CLAUDE.md)** | AI agents / contributors | Architecture rules, engine constants, integration notes |
| **[GAME-GUIDE-AND-RULES.md](./GAME-GUIDE-AND-RULES.md)** | Players | Plain-language rules; cross-check for engine behaviour and badges |

When **MVP.md** and **PRD.md** disagree on scope, **MVP.md wins** for current work.

## Architecture

Three decoupled layers, in strict order:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / 2D / 3D)
```

1. **Engine** — Poisson model decides the *final score* (and penalties for knockout draws). Pure numbers; no rendering.
2. **Timeline** — deterministic, serialisable match events generated *from* the already-decided score + seed. The final event always reconciles to the engine score.
3. **Presentation** — text ticker, 2D top-down animation, (later) 3D grass. All are consumers of the same timeline.

**This is not FIFA or Football Manager.** The result exists first; Normal/Fast modes are a **scripted replay** of that result. Cosmetic filler (passes, shots, corners) must never change the score.

**Explicitly out of scope in this repo:**

- **Live physics / player AI** that decides goals during play
- **Standalone browser demo** (no Vite harness; verify via CLI + tests)
- **Client-authoritative** outcomes for online or daily challenge

## Milestone status

| Milestone | Status | In this repo |
| --------- | ------ | ------------ |
| **M1** Engine + timeline | ✅ Done | `src/engine.ts`, `src/timeline/`, `src/consumers/fastText.ts`, `src/cli/simulate.ts` |
| **M2** 2D renderer | 🔶 Library only | `src/render/` (tests in `test/`); integrates into Next.js app — no local demo |
| **M3** Chemistry + tactics | ⏳ Deferred | Engine accepts effective `attack`/`defense`; UI wiring in main app |
| **M4–M7** Stats, online, highlights, daily | ⏳ Deferred | See [MVP.md](./MVP.md) |

Public npm-style export (`src/index.ts`) is **engine + timeline + Fast text only** — canvas/DOM code stays out so the bundle is server-safe.

## Repository layout

```
src/
  engine.ts          # Poisson match engine + penalties
  poisson.ts         # Knuth sampler
  rng.ts             # mulberry32
  constants.ts       # Engine + timeline tuning knobs
  types.ts           # MatchTimeline schema (PRD §7.3)
  lineup.ts          # Default XI helpers
  timeline/          # generate.ts, filler, minutes, clusters
  consumers/         # fastText.ts — Fast tier / accessibility path
  render/            # M2 2D library (not exported from index.ts)
  cli/simulate.ts    # Terminal match runner
test/                # vitest — engine, timeline, render director
```

## Commands

```bash
pnpm install
pnpm test            # vitest — engine, RNG, Poisson, timeline reconciliation, render
pnpm typecheck       # tsc --noEmit
pnpm build           # tsc emit to dist/

# Run a match as Fast text in the terminal:
pnpm sim --home 91 --away 76 --seed demo123
pnpm sim --home 84 --phase final --seed cup-run-7   # campaign phase + knockout
```

`--phase` accepts `group1|group2|group3|r16|qf|sf|final` and sets opponent overall (68/72/76/79/83/87/91) and the knockout flag.

## Integration with the live game

The production app is **Next.js (App Router)**, auth via **better-auth**, i18n **PT / EN / ES**. Reuse existing API routes:

- `/api/match/record` — results
- `/api/shorten` — invite / highlight / daily links
- `/api/metric` — telemetry
- `/api/auth` — sessions

For online (M5) and daily (M7): **Supabase** Realtime + server route/Edge Function for authoritative engine + timeline (see MVP §4.3, PRD §9.5).

## Calibration

Values not fixed by the live game (goal-minute distribution, filler density) live in [`src/constants.ts`](./src/constants.ts). Open product decisions: [MVP.md §9](./MVP.md), [PRD.md §15](./PRD.md).
