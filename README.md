# 7a0 engine + timeline (MVP M1)

Server-authoritative, pure-function **match engine** and **event-timeline generator** for 7a0 ("Sete a Zero"). This is milestone **M1** from [`MVP.md`](./MVP.md) — the foundation every later milestone consumes.

The architecture is three decoupled layers (see [`CLAUDE.md`](./CLAUDE.md)):

```
ENGINE (numbers)  →  TIMELINE (events)  →  PRESENTATION
```

- **Engine** ([`src/engine.ts`](./src/engine.ts)) decides the score (Poisson goal model; penalty model for knockout draws). No rendering, no live simulation.
- **Timeline** ([`src/timeline/`](./src/timeline)) turns the decided result + seed into an ordered, serialisable `MatchTimeline` (schema: [`src/types.ts`](./src/types.ts), per PRD §7.3). The final `fulltime` event always reconciles to the engine score — presentation can never disagree with the result.
- **Consumers** ([`src/consumers/`](./src/consumers)) read the timeline. M1 ships the **Fast text** ticker (also the accessibility path). The 2D renderer (M2) and stats (M4) are later consumers of the same data.

Everything is deterministic in a seed string, so it runs server-side unchanged for online + daily (server authority is mandatory there).

## Commands

```bash
pnpm install
pnpm test          # vitest — engine, RNG, Poisson, timeline reconciliation
pnpm typecheck     # tsc --noEmit
pnpm sim --home 91 --away 76 --seed demo123        # Fast text of a match
pnpm sim --home 84 --phase final --seed cup-run-7  # campaign phase + knockout
```

`--phase` accepts `group1|group2|group3|r16|qf|sf|final` and sets the opponent overall (68/72/76/79/83/87/91) and knockout flag automatically.

## What's intentionally deferred

Chemistry + tactics modifiers (M3) — the engine already accepts the effective `attack`/`defense` they produce. 2D renderer (M2), stats (M4), online rooms / Supabase (M5), highlight links (M6), daily challenge (M7), 3D (post-MVP).

## Calibration knobs

Values not defined by the live game (goal-minute distribution, filler density) live as named constants in [`src/constants.ts`](./src/constants.ts) and are tunable — see open decisions in `MVP.md §9` / `PRD.md §15`.
