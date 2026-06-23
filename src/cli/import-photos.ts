#!/usr/bin/env tsx
/**
 * Overlay Wikimedia Commons headshots onto the catalog via Wikidata lookup.
 *
 * Usage:
 *   pnpm build:catalog
 *   pnpm import:photos --overlay ./data/catalog.json
 *   pnpm import:squads --dir ./squads/curated --overlay ./data/catalog.json
 *
 * Curated/external photoUrl values are never overwritten unless already missing.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import {
  emptyPhotoCache,
  mergePhotosIntoCatalog,
  parsePhotoCache,
  type PhotoCache,
} from "../catalog/wikimediaPhotos.js";

function parseArgs(argv: string[]): {
  overlay: string;
  out: string;
  cache: string;
  limit: number | undefined;
  force: boolean;
  dryRun: boolean;
  delayMs: number;
} {
  let overlay = "./data/catalog.json";
  let out = "./data/catalog.json";
  let cache = "./data/player-photos.json";
  let limit: number | undefined;
  let force = false;
  let dryRun = false;
  let delayMs = 200;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--overlay" && argv[i + 1]) overlay = argv[++i]!;
    if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    if (a === "--cache" && argv[i + 1]) cache = argv[++i]!;
    if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
    if (a === "--delay-ms" && argv[i + 1]) delayMs = Number(argv[++i]);
    if (a === "--force") force = true;
    if (a === "--dry-run") dryRun = true;
  }

  return { overlay, out, cache, limit, force, dryRun, delayMs };
}

async function loadCatalog(path: string): Promise<SquadCatalog> {
  const text = await readFile(path, "utf8");
  return hydrateCatalog(JSON.parse(text) as SquadCatalog);
}

async function loadCache(path: string): Promise<PhotoCache> {
  try {
    await access(path);
    const text = await readFile(path, "utf8");
    return parsePhotoCache(JSON.parse(text));
  } catch {
    return emptyPhotoCache();
  }
}

async function writeCatalog(catalog: SquadCatalog, outPath: string): Promise<void> {
  const json = JSON.stringify(catalog, null, 2);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, json, "utf8");

  const webPath = resolve("apps/web/public/catalog.json");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, json, "utf8");
}

async function writeCache(cache: PhotoCache, path: string): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(cache, null, 2), "utf8");
}

async function main() {
  const { overlay, out, cache, limit, force, dryRun, delayMs } = parseArgs(
    process.argv.slice(2),
  );

  const overlayPath = resolve(overlay);
  try {
    await access(overlayPath);
  } catch {
    console.error(`Catalog not found: ${overlayPath}`);
    console.error("Run pnpm build:catalog first.");
    process.exit(1);
  }

  const base = await loadCatalog(overlayPath);
  const cachePath = resolve(cache);
  const photoCache = await loadCache(cachePath);

  console.log(
    `Importing photos (${Object.keys(base.players).length} players, cache ${Object.keys(photoCache.byPlayerId).length} entries)…`,
  );

  const result = await mergePhotosIntoCatalog(base, {
    cache: photoCache,
    force,
    ...(limit !== undefined ? { limit } : {}),
    dryRun,
    delayMs,
    onProgress: (done, total, player) => {
      if (done % 25 === 0 || done === total) {
        process.stdout.write(`\r  ${done}/${total} — ${player.name.slice(0, 32).padEnd(32)}`);
      }
    },
  });

  process.stdout.write("\n");

  if (!dryRun) {
    const outPath = resolve(out);
    await writeCatalog(result.catalog, outPath);
    await writeCache(
      {
        byPlayerId: {
          ...photoCache.byPlayerId,
          ...Object.fromEntries(
            Object.entries(result.catalog.players)
              .filter(([, p]) => p.photoUrl && p.photoSource === "wikimedia")
              .map(([id, p]) => [
                id,
                {
                  photoUrl: p.photoUrl!,
                  photoSource: p.photoSource!,
                },
              ]),
          ),
        },
      },
      cachePath,
    );
    console.log(`Wrote catalog → ${outPath}`);
    console.log(`Wrote cache → ${cachePath}`);
    console.log(`Web viewer copy → ${resolve("apps/web/public/catalog.json")}`);
  } else {
    console.log("(dry run — no files written)");
  }

  console.log(
    `Photos: ${result.matched} matched, ${result.skipped} no image, ${result.protected} protected, ${result.failed} failed`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
