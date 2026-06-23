# Online Duel (M4) — setup & verification

Server-authoritative 1v1 duel: Convex owns the seed, validates both builds by
**replaying** their action logs, runs the engine, and broadcasts one canonical
timeline. See `plan-m4-online-1v1` for the design.

## One-time setup

The Convex functions import the **built** engine (`7a0-engine/dist`) so esbuild
resolves its `.js` specifiers. Build the engine first, then start Convex:

```bash
# from repo root
pnpm install
pnpm build                       # emits dist/ (required by convex/duelCatalog.ts)

# from apps/web (interactive: prompts a Convex login + project the first time)
cd apps/web
npx convex dev                   # generates convex/_generated/ and writes
                                 # NEXT_PUBLIC_CONVEX_URL into .env.local
```

Leave `npx convex dev` running (it watches `convex/` and pushes functions), and
in another terminal:

```bash
pnpm --filter web dev            # Next.js on http://localhost:3000
pnpm --filter web typecheck      # now passes (convex/_generated exists)
```

> Re-run `pnpm build` (root) whenever the engine changes, so Convex bundles the
> latest `dist/`.

## Files

- `convex/schema.ts` — rooms, roomPlayers, builds, timelines, results.
- `convex/duel.ts` — createRoom / joinRoom / setPresence / startDraw /
  submitBuild / rematch (mutations), `roomState` (reactive query),
  `finalizeDuel` (internal, idempotent server resolution).
- `convex/duelCatalog.ts` — the shared catalog (engine `demoCatalog`).
- `app/duel/page.tsx` — lobby → build → reveal flow, reusing `BuildPanel`,
  `FormationPicker`, `MatchView`, `StatsPanel`, `ResultCard`.
- Engine: `7a0-engine` `replayBuild` / `resolveDuel` (`src/online.ts`).

## Manual end-to-end check

1. Open `/duel` in two browser profiles (separate localStorage → two players).
2. Profile A: **Create room** → share the invite link / code.
3. Profile B: **Join** with the code. Both appear in the presence bar.
4. A (host): **Start draft**. Both pick a formation and draft an XI against the
   same 90s countdown. The scenario rolls are **identical** for both (shared
   seed) — only picks/rerolls/tactic differ.
5. Both **Confirm lineup** (or let the timer expire). Both reveal the **same**
   scoreline at the same time; each can read Fast or Ultra Fast.
6. Host taps rematch → fresh draw, new server seed, same players.

## AFK / robustness

- If a player never confirms, the scheduled `finalizeDuel` fires at the deadline
  and auto-fills their XI (`autoFillLineup`); the match still resolves.
- A tampered/illegal action log fails `replayAndValidate` and is replaced by a
  neutral auto-filled XI (anti-cheat, PRD §9.7).

## Engine-layer verification (no Convex needed)

```bash
pnpm test        # includes test/online.test.ts (replay determinism + anti-cheat)
pnpm typecheck
```

## Follow-ups

- Full 5,729-player catalog online: store it server-side (Convex storage) and
  load it in `duelCatalog.ts` instead of the demo set.
- better-auth identity in place of the localStorage `playerId`.
