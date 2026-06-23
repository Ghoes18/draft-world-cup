# Player photos

Headshots come from **Wikimedia Commons** (CC / public domain). Only **World Cup legends** get photos — not every squad member.

## Legend roster

Defined in `src/legends.ts` (`LEGEND_ROSTER`). Each entry has:

- Display name (UI / hero ticker)
- Normalized name aliases for catalog matching
- One Commons thumbnail URL

To add a legend: append to `LEGEND_ROSTER` with a stable Commons filename. Run `pnpm test test/legends.test.ts`.

## What we do **not** do

- Bulk `import:photos` over the full ~10k catalog (too slow; mostly unused).
- Per-squad photos in `squads/curated/*.json` (positions/overall only).

## Pipeline

1. `pnpm build:catalog` — Fjelstul base + curated positions/overall + **legend photos only**
2. Web app applies the same legend patch at load time via `prepareGameCatalog`

## Attribution

When showing a legend photo, credit **Wikimedia Commons** and the file author where required. See each file’s Commons page for license details.
