# CLAUDE.md

Guidance for AI agents and contributors working in this repository.

## Project state

This repo is an active **TypeScript** package (`7a0-engine`) that implements the **7a0** / "Sete a Zero" match stack: Poisson engine, deterministic timeline, and Fast-text consumer — **text-only presentation** like the original 7a0.

The live game already exists on the web; this code is the **server-safe foundation** for text simulation (Fast/Ultra Fast), online duel, highlights, and daily challenge.

### Documentation hierarchy

1. **`MVP.md`** — **source of truth for what to build now** (milestones M1–M6).
2. **`PRD.md`** — long-term vision (ELO, brackets). Treat as post-MVP unless MVP explicitly includes it.
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
| Text match viewer | `apps/web/` | Fast ticker + Ultra Fast instant |
| Tests | `test/` | `pnpm test`, `pnpm typecheck` |

### What is explicitly NOT in this repo

- **Live physics / player AI** simulation that decides goals during play (FIFA-style). Rejected — use engine → timeline → presentation only.
- **Animated match views** (2D, 3D, canvas, video). Presentation is text-only.
- **Vite / browser demo harness** — removed; do not reintroduce unless product asks.
- **Convex** — planned backend for online (M4) and daily (M6); not wired in this repo yet (MVP §4.2, PRD §9.5).
- **Client-side authoritative** simulation for competitive modes.

## The central architecture decision

**Decouple the result from its presentation.** Three layers, strict order:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / Ultra Fast)
```

1. **Engine** — pure Poisson model decides the *final score* (and penalties for knockout draws). No rendering, no live simulation.
2. **Timeline** — deterministic, serializable events from the already-decided score + seed. Final event always reconciles to the engine score.
3. **Presentation** — Fast text ticker and Ultra Fast instant result. Different *consumers of the same timeline*.

Consequences:

- **Scripted replay of a pre-decided result**, not real-time physics deciding outcomes.
- Filler events (passes, shots, corners) are cosmetic and **must never change the score**.
- Timeline generator and presentation consumers stay decoupled — if a change couples them, reconsider.

## Server authority is non-negotiable

The engine is seed-deterministic. Client-side seeds are trivially manipulable. For **online duel** and **daily challenge**, the **server** must own the draw, seed, engine run, and timeline generation. The client only presents a result it receives.

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

- **Fast** — minute-by-minute text ticker; **accessibility / screen-reader path**; play/pause, skip-to-result.
- **Ultra Fast** — instant final score + badges (original 7a0 behaviour).

Switching tiers mid-match must never change the outcome. Tier is a persisted preference.

Schema and event types: **PRD.md §7.3** (`src/types.ts` in code). Online sends **one canonical timeline**; each player reads it at their own speed tier.

## Existing platform to integrate with

Live game: **Next.js (App Router)**, **better-auth**, i18n **PT / EN / ES**. Reuse:

- `/api/match/record`, `/api/shorten`, `/api/metric`, `/api/auth`

Proposed realtime (MVP §4.2 / PRD §9.5): **Convex** — reactive queries/subscriptions for rooms and match state, mutations/actions for engine+timeline. Data sketches: MVP §5, PRD §11.

## MVP build order

1. ~~**M1** — server-authoritative engine + timeline (pure functions; verify via `pnpm sim`).~~ ✅
2. **M2** — chemistry + tactics in engine + Build UI.
3. **M3** — match statistics from timeline.
4. **M4** — online 1v1 duel.
5. **M5** — shareable highlights (text goal replay).
6. **M6** — daily challenge.

## Development commands

```bash
pnpm test
pnpm typecheck
pnpm sim --home 91 --away 76 --seed demo123
```

## Open calibration (don't invent silently)

See MVP.md §9 / PRD.md §15: tactic δ, chemistry range, build-timer length, win rule (default head-to-head, tie → penalties), incomplete-XI handling (default neutral auto-fill).
