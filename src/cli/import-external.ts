#!/usr/bin/env tsx
/**
 * Overlay external CSV ratings onto the Fjelstul catalog base.
 *
 * Usage:
 *   pnpm build:catalog
 *   pnpm import:external --csv ./data/external-ratings.csv --overlay ./data/catalog.json
 *
 * CSV columns: name, year, team, overall, positions (optional)
 * Precedence: runs before curated squads; import:squads --overlay wins on conflicts.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import { overlayRawExportOnCatalog } from "../catalog/catalogOverlay.js";
import {
  externalRowsToRawExport,
  parseExternalRatingsCsv,
} from "../catalog/externalRatings.js";

function parseArgs(argv: string[]): {
  csv: string;
  overlay: string;
  out: string;
} {
  let csv = "";
  let overlay = "./data/catalog.json";
  let out = "./data/catalog.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--csv" && argv[i + 1]) csv = argv[++i]!;
    if (argv[i] === "--overlay" && argv[i + 1]) overlay = argv[++i]!;
    if (argv[i] === "--out" && argv[i + 1]) out = argv[++i]!;
  }
  return { csv, overlay, out };
}

async function loadCatalog(path: string): Promise<SquadCatalog> {
  const text = await readFile(path, "utf8");
  return hydrateCatalog(JSON.parse(text) as SquadCatalog);
}

async function writeCatalog(catalog: SquadCatalog, outPath: string): Promise<void> {
  const json = JSON.stringify(catalog, null, 2);
  await mkdir(dirname(outPath), { recursive: true });
  await writeFile(outPath, json, "utf8");

  const webPath = resolve("apps/web/public/catalog.json");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, json, "utf8");
}

async function main() {
  const { csv, overlay, out } = parseArgs(process.argv.slice(2));

  if (!csv) {
    console.error("Usage: pnpm import:external --csv ./data/ratings.csv --overlay ./data/catalog.json");
    process.exit(1);
  }

  const csvPath = resolve(csv);
  try {
    await access(csvPath);
  } catch {
    console.error(`CSV not found: ${csvPath}`);
    process.exit(1);
  }

  const overlayPath = resolve(overlay);
  const base = await loadCatalog(overlayPath);
  const text = await readFile(csvPath, "utf8");
  const rows = parseExternalRatingsCsv(text);

  if (rows.length === 0) {
    console.error("No valid rows in CSV.");
    process.exit(1);
  }

  const raw = externalRowsToRawExport(rows);
  const result = overlayRawExportOnCatalog(base, [raw]);
  const outPath = resolve(out);

  await writeCatalog(result.catalog, outPath);

  console.log(
    `External overlay: ${result.patched} patched, ${result.unmatched} unmatched (${rows.length} CSV rows)`,
  );
  console.log(
    `Wrote ${result.catalog.scenarios.length} scenarios, ${Object.keys(result.catalog.players).length} players → ${outPath}`,
  );
  console.log(`Web viewer copy → ${resolve("apps/web/public/catalog.json")}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
