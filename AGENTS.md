## Learned User Preferences

- Live player AI should stay simple and fun — per-player attack (pass, dribble, shoot, position) and defense (block, mark, formation, trap), not RoboCup-level complexity or ML.
- RoboCup repos (Pyrus2D, WrightEagle) are concept inspiration only; do not port their agent frameworks into this codebase.
- Live simulation outcomes must be chance-based, not deterministic: weight by team overall, individual player overall, opposing team/player ratings, and soccer luck (EA FC/FIFA style).
- Higher player overalls should raise success probabilities for passing, dribbling, shooting, defending, and goalkeeper saves — never guarantee outcomes.
- Normal-tier match motion must feel like real football: players run and contest possession; passes must not look like missiles; the ball must not teleport or feel scripted.
- When implementing attached plans, do not edit the plan file itself; use the existing todos and mark them in progress as you work.

## Learned Workspace Facts

- M1 is complete: pure TypeScript engine, timeline generator, Fast-text consumer, CLI, and vitest suite under `src/`.
- M2 2D renderer lives in `src/render/` and is intentionally excluded from `src/index.ts` so the engine bundle stays canvas/DOM-free and server-safe.
- Live AI football simulation lives in `src/live/` (`phase.ts`, `decision.ts`, `simulator.ts`, `outcomes.ts`, `attributes.ts`).
- Demo harness uses Vite (`pnpm dev`); verify with `pnpm typecheck` and `pnpm test`.
- CLAUDE.md still says "no code" in places — that line is stale; the repo has an active codebase.
