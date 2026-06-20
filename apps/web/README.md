# web — 7a0 match viewer

Next.js (App Router) app that presents a `MatchTimeline` from `7a0-engine` as
text, like the original 7a0:

- **Ticker** — minute-by-minute text reveal (also the screen-reader path).
- **Instant result** — the full result printed at once (original 7a0 behaviour).

Both modes read the engine's `toFastText` consumer. The app also has a
**scenario roll → build XI → simulate** flow using the squad catalog from
`public/catalog.json` (run `pnpm build:catalog` at repo root). Falls back to
`demoCatalog` (3 squads) when that file is missing.

## Run

From the repo root:

```bash
pnpm install
pnpm build:catalog        # optional: full World Cup squads → public/catalog.json
pnpm --filter web dev     # http://localhost:3000
```

> Use plain `next dev` (webpack), **not** `--turbo` / `--turbopack`. The engine
> ships raw TypeScript with NodeNext-style `.js` import specifiers; `next.config.mjs`
> teaches webpack to resolve those to `.ts` via `resolve.extensionAlias`.

```bash
pnpm --filter web build       # production build
pnpm --filter web typecheck
pnpm --filter web dev:clean   # wipe .next then dev (see troubleshooting)
```

## Troubleshooting dev errors

If you see errors like:

- `Cannot find module './543.js'`
- `__webpack_modules__[moduleId] is not a function`
- `SegmentViewNode` / React Client Manifest

the local `.next` cache is usually stale (often after `next build` then `next dev`).

```bash
pnpm --filter web clean
pnpm --filter web dev
# or: pnpm --filter web dev:clean
```

Do not run `next dev --turbo` in this monorepo unless Turbopack is configured for
`7a0-engine` TypeScript resolution.
