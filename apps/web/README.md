# web — 7a0 match viewer

Next.js (App Router) app that presents a `MatchTimeline` from `7a0-engine` **as
text** (no 2D), like the original 7a0:

- **Ticker** — minute-by-minute text reveal (also the screen-reader path).
- **Instant result** — the full result printed at once (original 7a0 behaviour).

Both modes read the engine's `toFastText` consumer. The app also has a simple
roll + simulate flow with sample teams (`app/_data/scenarios.ts`). Real player
data, chemistry, and tactics arrive with M3.

## Run

From the repo root:

```bash
pnpm install
pnpm --filter web dev      # http://localhost:3000
```

> **Use the webpack dev server (plain `next dev`), not Turbopack.** The engine
> ships raw TypeScript with NodeNext-style `.js` import specifiers; `next.config.mjs`
> teaches webpack to resolve those to `.ts` via `resolve.extensionAlias`. Turbopack
> handles extension aliasing differently and is not configured here.

```bash
pnpm --filter web build    # production build
pnpm --filter web typecheck
```
