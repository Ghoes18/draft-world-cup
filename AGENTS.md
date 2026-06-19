## Learned User Preferences

- Match simulation follows the original 7a0 model documented in **CLAUDE.md** / **GAME-GUIDE-AND-RULES.md §5.7**: engine (Poisson) decides the result first, then a deterministic timeline, then presentation. Not live physics/AI deciding goals.
- When implementing attached plans, do not edit the plan file itself; use the existing todos and mark them in progress as you work.

## Learned Workspace Facts

- **Source of truth for docs:** README.md, CLAUDE.md, MVP.md, PRD.md, GAME-GUIDE-AND-RULES.md (see README documentation map).
- M1 complete; M2 render library in `src/render/` (no browser demo). Verify with `pnpm typecheck`, `pnpm test`, `pnpm sim`.
