#!/usr/bin/env tsx
/**
 * Import squad JSON files into a normalized catalog (forces in clear text).
 *
 * Usage:
 *   pnpm import:squads --dir ./squads/curated --overlay ./data/catalog.json
 *
 * Accepts (recursive under --dir):
 * - Autoral format:  { scenarios: [...] }  — curated positions + overall
 * - Live 7a0 format: { sel, copa, squad: [...] }
 *
 * Pipeline precedence: build:catalog (heuristic) < import:external < import:squads.
 */

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import {
  hydrateCatalog,
  normalizeCatalog,
  type LiveSquadJson,
  type RawCatalogExport,
  type SquadCatalog,
} from "../catalog.js";
import { applyLegendPhotosToCatalog } from "../legends.js";
import {
  mergeRawCatalogExports,
  overlayRawExportOnCatalog,
} from "../catalog/catalogOverlay.js";
import {
  catalogFromLiveSquads,
  isLiveSquadJson,
  isRawCatalogExport,
  overlayLiveSquadsOnCatalog,
} from "../catalog/liveImport.js";

function parseArgs(argv: string[]): {
  dir: string;
  out: string;
  overlay: string | null;
} {
  let dir = "./squads";
  let out = "./data/catalog.json";
  let overlay: string | null = null;
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) dir = argv[++i]!;
    if (argv[i] === "--out" && argv[i + 1]) out = argv[++i]!;
    if (argv[i] === "--overlay" && argv[i + 1]) overlay = argv[++i]!;
  }
  return { dir, out, overlay };
}

async function loadJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as unknown;
}

async function listJsonFilesRecursive(dirPath: string): Promise<string[]> {
  const files: string[] = [];
  const entries = await readdir(dirPath, { withFileTypes: true });
  for (const entry of entries) {
    const full = join(dirPath, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "examples") continue;
      files.push(...(await listJsonFilesRecursive(full)));
    } else if (entry.isFile() && entry.name.endsWith(".json")) {
      files.push(full);
    }
  }
  return files.sort();
}

async function loadOverlayBase(path: string): Promise<SquadCatalog> {
  const data = await loadJson(path);
  if (
    typeof data !== "object" ||
    data === null ||
    !Array.isArray((data as SquadCatalog).scenarios) ||
    typeof (data as SquadCatalog).players !== "object"
  ) {
    throw new Error(`--overlay file is not a SquadCatalog: ${path}`);
  }
  return hydrateCatalog(data as SquadCatalog);
}

async function writeCatalog(catalog: SquadCatalog, outPath: string): Promise<void> {
  const patched = applyLegendPhotosToCatalog(catalog);
  const json = JSON.stringify(patched, null, 2);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, json, "utf8");

  const webPath = resolve("apps/web/public/catalog.json");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, json, "utf8");
}

async function main() {
  const { dir, out, overlay } = parseArgs(process.argv.slice(2));
  const dirPath = resolve(dir);

  try {
    await access(dirPath);
  } catch {
    console.error(`Directory not found: ${dirPath}`);
    console.error("See squads/README.md");
    process.exit(1);
  }

  const files = await listJsonFilesRecursive(dirPath);
  if (files.length === 0) {
    console.error(`No JSON files under ${dirPath}`);
    console.error("Add curated squad JSON under squads/curated/ — see squads/README.md");
    process.exit(1);
  }

  const liveSquads: LiveSquadJson[] = [];
  const autoralExports: RawCatalogExport[] = [];

  for (const filePath of files) {
    const data = await loadJson(filePath);
    if (isLiveSquadJson(data)) {
      liveSquads.push(data);
    } else if (isRawCatalogExport(data)) {
      autoralExports.push(data);
    } else {
      console.warn(`Skipping unrecognized format: ${filePath}`);
    }
  }

  if (liveSquads.length === 0 && autoralExports.length === 0) {
    console.error("No valid squad files found.");
    process.exit(1);
  }

  let catalog: SquadCatalog;
  let patched = 0;
  let unmatched = 0;

  if (overlay) {
    catalog = await loadOverlayBase(resolve(overlay));

    if (autoralExports.length > 0) {
      const merged = mergeRawCatalogExports(autoralExports);
      const result = overlayRawExportOnCatalog(catalog, [merged]);
      catalog = result.catalog;
      patched += result.patched;
      unmatched += result.unmatched;
    }

    if (liveSquads.length > 0) {
      const result = overlayLiveSquadsOnCatalog(catalog, liveSquads);
      catalog = result.catalog;
      patched += result.patched;
      unmatched += result.unmatched;
    }

    console.log(`Overlay: ${patched} players patched, ${unmatched} unmatched`);
  } else if (liveSquads.length > 0) {
    catalog = catalogFromLiveSquads(liveSquads);
  } else {
    catalog = normalizeCatalog(mergeRawCatalogExports(autoralExports));
  }

  const outPath = resolve(out);
  await writeCatalog(catalog, outPath);

  console.log(
    `Wrote ${catalog.scenarios.length} scenarios, ${Object.keys(catalog.players).length} players → ${outPath}`,
  );
  console.log(`Web viewer copy → ${resolve("apps/web/public/catalog.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
