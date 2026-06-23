#!/usr/bin/env tsx
/**
 * Build the full World Cup squad catalog from the Fjelstul open database.
 *
 * Usage:
 *   pnpm build:catalog
 *   pnpm build:catalog --out ./data/catalog.json --cache ./data/fjelstul
 *   pnpm build:catalog --from 1950 --to 2022
 *
 * Data: Fjelstul World Cup Database (CC-BY-SA 4.0)
 * https://github.com/jfjelstul/worldcup
 *
 * Player forces are autoral (appearances + goals), not live 7a0 values.
 */

import { access, mkdir, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import {
  buildCatalogFromFjelstul,
  defaultFjelstulPaths,
  FJELSTUL_FILES,
  fjelstulDownloadUrl,
} from "7a0-engine/server";
import { normalizeCatalog } from "../catalog.js";
import { overlayRawExportOnCatalog } from "../catalog/catalogOverlay.js";
import { applyLegendPhotosToCatalog } from "../legends.js";
import { loadCuratedExportsFromDir } from "./curatedSquadsLoader.js";

interface CliArgs {
  out: string;
  cache: string;
  from: number;
  to: number;
  skipDownload: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let out = "./data/catalog.json";
  let cache = "./data/fjelstul";
  let from = 1930;
  let to = 2022;
  let skipDownload = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--cache" && argv[i + 1]) cache = argv[++i]!;
    else if (a === "--from" && argv[i + 1]) from = Number(argv[++i]);
    else if (a === "--to" && argv[i + 1]) to = Number(argv[++i]);
    else if (a === "--skip-download") skipDownload = true;
  }

  return { out, cache, from, to, skipDownload };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function downloadFjelstul(cacheDir: string): Promise<void> {
  await mkdir(cacheDir, { recursive: true });

  for (const file of FJELSTUL_FILES) {
    const dest = `${cacheDir}/${file}`;
    if (await fileExists(dest)) continue;

    const url = fjelstulDownloadUrl(file);
    process.stderr.write(`Downloading ${file}…\n`);
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`Failed to download ${url}: ${res.status}`);
    }
    const text = await res.text();
    await writeFile(dest, text, "utf8");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cacheDir = resolve(args.cache);
  const outPath = resolve(args.out);

  if (!args.skipDownload) {
    await downloadFjelstul(cacheDir);
  }

  const paths = defaultFjelstulPaths(cacheDir);
  for (const file of FJELSTUL_FILES) {
    const p = `${cacheDir}/${file}`;
    if (!(await fileExists(p))) {
      console.error(`Missing ${p}. Run without --skip-download or place CSVs manually.`);
      process.exit(1);
    }
  }

  const raw = await buildCatalogFromFjelstul(paths, {
    mensOnly: true,
    fromYear: args.from,
    toYear: args.to,
  });
  let catalog = normalizeCatalog(raw);

  const curated = await loadCuratedExportsFromDir();
  if (curated.length > 0) {
    const result = overlayRawExportOnCatalog(catalog, curated);
    catalog = result.catalog;
    console.log(
      `Curated overlay: ${result.patched} players patched, ${result.unmatched} unmatched`,
    );
  }

  catalog = applyLegendPhotosToCatalog(catalog);
  const legendPhotos = Object.values(catalog.players).filter(
    (p) => p.photoUrl,
  ).length;
  console.log(`Legend photos: ${legendPhotos} players`);

  const catalogJson = JSON.stringify(catalog, null, 2);

  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, catalogJson, "utf8");

  const webPath = resolve("apps/web/public/catalog.json");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, catalogJson, "utf8");

  const playerCount = Object.keys(catalog.players).length;
  console.log(
    `Wrote ${catalog.scenarios.length} scenarios, ${playerCount} players (${args.from}–${args.to}, men's) → ${outPath}`,
  );
  console.log(`Web viewer copy → ${webPath}`);
  console.log(
    "Forces are autoral (Fjelstul appearances). Replace with licensed 7a0 JSON via pnpm import:squads when available.",
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
