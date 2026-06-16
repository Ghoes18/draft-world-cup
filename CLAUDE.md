# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project state

This repo currently contains **only design documents — no code, no `package.json`, no git**. The product (**7a0** / "Sete a Zero") is an existing live web game; these docs specify a set of upgrades to it. When you start implementing, you are scaffolding from scratch against the specs below; there is no build/lint/test tooling here yet, so add it as part of the first implementation milestone rather than expecting to find it.

The three docs, in increasing order of "what to build right now":
- `MVP.md` — **the source of truth for what to build first.** The smallest launchable scope and its milestone order (M1–M7).
- `PRD.md` — the full long-term vision (3D renderer, ELO/matchmaking, brackets). Most of this is explicitly *out of scope for the MVP*; treat it as the post-MVP roadmap, not the current task list.
- `GAME-GUIDE-AND-RULES.md` — player-facing rules. Useful as a plain-language cross-check on engine behavior and badge definitions.

When MVP.md and PRD.md disagree on scope, **MVP.md wins** for current work.

## The central architecture decision

Everything hinges on one principle: **decouple the result from its presentation.** Three layers, in strict order:

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION (text / 2D / 3D)
```

1. **Engine** — a pure Poisson model that decides the *final score* (and penalties for knockout draws). No rendering, no live simulation.
2. **Timeline** — a deterministic, serializable list of match events generated *from* the already-decided score + seed. This is the heart of the system. The final event always reconciles to the engine's exact score, so the animation can never disagree with the result.
3. **Presentation** — text ticker, 2D top-down animation, (later) 3D grass. All three are just different *consumers of the same timeline*.

Consequences to keep in mind whenever you touch this code:
- The game is a **scripted replay of a pre-decided result**, NOT a live physics/AI simulation (not FIFA, not Football Manager). Filler events (passes, shots, corners) are cosmetic and must never change the score.
- Enriching the timeline generator must never require touching the renderers, and vice versa. If a change couples them, reconsider it.
- 2D and 3D share **one normalized top-down coordinate system** `(x, y)` in `0..1` (x = goal-to-goal length, y = touchline width). 3D is a *visual skin* of the 2D layout, not a separate mode — there are no "3D-only" positions.

## Server authority is non-negotiable

The engine is seed-deterministic. A client-side seed is trivially manipulable, so for any competitive mode (**online duel** and **daily challenge**) the **server** must own the draw, the seed, the engine run, and the timeline generation. The client only *animates a result it receives*. Build the engine + timeline as pure functions that can run server-side from day one (this is milestone M1 precisely because everything else depends on it).

## Engine constants (must match exactly — this is what makes new modes "feel" like the original)

```
Expected goals:   λ = clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5)
Goals scored:     goals ~ Poisson(λ)                          // Knuth's algorithm
Knockout draws:   penaltyWin = clamp(0.5 + Δstrength × 0.012, 0.1, 0.9)
RNG:              mulberry32(seed)                             // deterministic, shareable
```

`attack`/`defense` are the team overall **after chemistry and tactics modifiers are applied**, in that pipeline order.

**Chemistry** (rewards correct player placement; all 11 are already eligible for the team/Cup):
```
chemistryBonus = round((chemistry% − 50) / 100 × 6)   // ≈ −3 … +3, applied to attack and defense
```

**Tactics** (one choice per match; δ ≈ 4, tunable):
- Offensive: attack +δ, your defense −δ
- Balanced: no change
- Defensive: attack −δ, your defense +δ

**Solo campaign** opponent overalls by phase: Group 68/72/76 · R16 79 · QF 83 · SF 87 · Final 91.

Example badge: *esmagador* → campaign goal difference ≥ 18.

## Speed tiers (all read the same `MatchTimeline`)

- **Normal** — animated 2D top-down; compresses ~90 min into ~60–90 s; skip-to-result + 1×/2× always available.
- **Fast** — minute-by-minute text ticker; this is also the **accessibility / screen-reader path**, so keep it fully usable without the canvas.
- **Ultra Fast** — instant final score + badges (original 7a0 behavior); the universal fallback when even 2D can't sustain the frame-rate floor (≥ 50 fps on weak PCs).

Switching tiers mid-match must never change the outcome. The tier is a persisted preference.

The `MatchTimeline` schema and event types are specified in `PRD.md §7.3` — follow it. Online sends **one canonical timeline** and each player renders at their own fidelity over the same result.

## Existing platform to integrate with

The live game is **Next.js (App Router)**, rendered client-side, auth via **better-auth** (sessions synced across tabs via BroadcastChannel), i18n in **PT / EN / ES** (all new UI must cover all three). Reuse these existing API routes rather than reinventing them:
- `/api/match/record` — results
- `/api/shorten` — invite links and highlight/daily share links
- `/api/metric` — telemetry (per-match: duration, abandonment, latency, errors, fps tier)
- `/api/auth` — sessions

Proposed realtime stack (PRD §9.5 / MVP §4.3): **Supabase** — Realtime channels (broadcast + presence) for room state, an Edge Function (or server route) for the authoritative engine+timeline run, Postgres for persistence. Data model sketches: `MVP.md §5` (MVP subset) and `PRD.md §11` (full).

## MVP build order (from MVP.md §6)

1. **M1** — server-authoritative engine + timeline generator (pure functions; verify via Fast text output). Foundation for online + daily.
2. **M2** — 2D top-down renderer (Canvas/Pixi) playing the timeline, with skip + speed controls.
3. **M3** — chemistry + tactics wired into the engine and surfaced in Build (live meter, tactic picker).
4. **M4** — match statistics screen (possession, shots, on-target, corners, penalties, passes, approximate xG — all derived from the timeline).
5. **M5** — online 1v1 duel (rooms by code, synced build, server sim, simultaneous reveal, rematch, basic reconnect/AFK).
6. **M6** — shareable highlights (replay link + Open Graph share card; no login to view).
7. **M7** — daily challenge (UTC-date daily seed, one official attempt, simple leaderboard, share).

Open calibration decisions (don't silently invent values — see MVP.md §9 / PRD.md §15): tactic δ, chemistry range, build-timer length, win rule (default: head-to-head, tie → penalties), incomplete-XI handling (default: neutral auto-fill).
