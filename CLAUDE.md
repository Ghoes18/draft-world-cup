# CLAUDE.md

Guidance for AI agents and contributors working in this repository.

## Project state

This repo is an active **TypeScript** package (`7a0-engine`) that implements the **7a0** / "Sete a Zero" match stack: Poisson engine, deterministic timeline, Fast-text consumer, and an M2 **2D render library** (not yet wired into the live Next.js app).

The live game already exists on the web; this code is the **server-safe foundation** for upgraded presentation (Normal/Fast/Ultra), online duel, highlights, and daily challenge.

### Documentation hierarchy

1. **`MVP.md`** — **source of truth for what to build now** (milestones M1–M7).
2. **`PRD.md`** — long-term vision (3D, ELO, brackets). Treat as post-MVP unless MVP explicitly includes it.
3. **`GAME-GUIDE-AND-RULES.md`** — player-facing rules; use to validate engine behaviour and badges.
4. **`README.md`** — repo layout, commands, milestone table.

When MVP.md and PRD.md disagree, **MVP.md wins**.

### What is implemented here

| Area | Location | Notes |
| ---- | -------- | ----- |
| Engine (Poisson + penalties) | `src/engine.ts`, `src/poisson.ts`, `src/rng.ts` | Must match live game constants exactly |
| Timeline generator | `src/timeline/` | Reconciles to engine score; schema in `src/types.ts` |
| Fast text consumer | `src/consumers/fastText.ts` | Accessibility / Fast tier |
| CLI verifier | `src/cli/simulate.ts` | `pnpm sim` |
| 2D render library (M2) | `src/render/` | **Not** in `src/index.ts` export; no standalone demo |
| Tests | `test/` | `pnpm test`, `pnpm typecheck` |

### What is explicitly NOT in this repo

- **Live physics / player AI** simulation that decides goals during play (FIFA-style). Rejected — use engine → timeline → presentation only.
- **Vite / browser demo harness** — removed; do not reintroduce unless product asks.
- **Convex** — not used here; proposed backend for online is Supabase per MVP/PRD.
- **Client-side authoritative** simulation for competitive modes.

## The central architecture decision

**Decouple the result from its presentation.** Three layers, strict order:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / 2D / 3D)
```

1. **Engine** — pure Poisson model decides the *final score* (and penalties for knockout draws). No rendering, no live simulation.
2. **Timeline** — deterministic, serializable events from the already-decided score + seed. Final event always reconciles to the engine score.
3. **Presentation** — text ticker, 2D top-down animation, (later) 3D grass. Different *consumers of the same timeline*.

Consequences:

- **Scripted replay of a pre-decided result**, not real-time physics deciding outcomes.
- Filler events (passes, shots, corners) are cosmetic and **must never change the score**.
- Timeline generator and renderers stay decoupled — if a change couples them, reconsider.
- 2D and 3D share **one normalized top-down coordinate system** `(x, y)` in `0..1` (x = goal-to-goal, y = touchline width). 3D is a visual skin of the 2D layout.

## Server authority is non-negotiable

The engine is seed-deterministic. Client-side seeds are trivially manipulable. For **online duel** and **daily challenge**, the **server** must own the draw, seed, engine run, and timeline generation. The client only animates a result it receives.

Build engine + timeline as **pure functions** runnable server-side from day one (M1).

## Engine constants (must match the live game exactly)

```
Expected goals:   λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)
Goals scored:     goals ~ Poisson(λ)                          // Knuth's algorithm
Knockout draws:   penaltyWin = clamp(0.5 + Δstrength × 0.012, 0.1, 0.9)
RNG:              mulberry32(seed)                             // deterministic, shareable
```

`attack`/`defense` = team overall **after chemistry and tactics modifiers**, in that order.

**Chemistry:**

```
chemistryBonus = round((chemistry% − 50) / 100 × 6)   // ≈ −3 … +3, applied to attack and defense
```

**Tactics** (one per match; δ ≈ 4, tunable):

- Offensive: attack +δ, your defense −δ
- Balanced: no change
- Defensive: attack −δ, your defense +δ

**Solo campaign** opponent overalls: Group 68/72/76 · R16 79 · QF 83 · SF 87 · Final 91.

Example badge: *esmagador* → campaign goal difference ≥ 18.

## Speed tiers (all read the same `MatchTimeline`)

- **Normal** — animated 2D top-down; ~90 min → ~60–90 s; skip-to-result + 1×/2×.
- **Fast** — minute-by-minute text ticker; **accessibility / screen-reader path**.
- **Ultra Fast** — instant final score + badges (original 7a0 behaviour); fallback when 2D can't sustain ≥ 50 fps.

Switching tiers mid-match must never change the outcome. Tier is a persisted preference.

Schema and event types: **PRD.md §7.3** (`src/types.ts` in code). Online sends **one canonical timeline**; each player renders at their own fidelity.

## M2 renderer notes (when touching `src/render/`)

- **Puppet-show, no physics/AI:** formation anchors + ball-relative block shift + idle noise.
- Ball: **lerp** (passes), **Bézier** (crosses, corners, shots).
- Motion should feel like football but is **driven by timeline events**, not simulating outcomes.
- `src/render/` is excluded from `src/index.ts` so the engine bundle stays canvas/DOM-free.

## Existing platform to integrate with

Live game: **Next.js (App Router)**, **better-auth**, i18n **PT / EN / ES**. Reuse:

- `/api/match/record`, `/api/shorten`, `/api/metric`, `/api/auth`

Proposed realtime (MVP §4.3 / PRD §9.5): **Supabase** — Realtime channels, server route for engine+timeline, Postgres. Data sketches: MVP §5, PRD §11.

## MVP build order

1. ~~**M1** — server-authoritative engine + timeline (pure functions; verify via `pnpm sim`).~~ ✅
2. **M2** — 2D renderer in main app playing the timeline (library exists in `src/render/`).
3. **M3** — chemistry + tactics in engine + Build UI.
4. **M4** — match statistics from timeline.
5. **M5** — online 1v1 duel.
6. **M6** — shareable highlights.
7. **M7** — daily challenge.

## Development commands

```bash
pnpm test
pnpm typecheck
pnpm sim --home 91 --away 76 --seed demo123
```

## Open calibration (don't invent silently)

See MVP.md §9 / PRD.md §15: tactic δ, chemistry range, build-timer length, win rule (default head-to-head, tie → penalties), incomplete-XI handling (default neutral auto-fill).
