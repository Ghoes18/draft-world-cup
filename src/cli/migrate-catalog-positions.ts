#!/usr/bin/env tsx
/**
 * Migrate catalog.json players to side-aware 28-position detail labels.
 *
 * Usage:
 *   pnpm migrate:catalog-positions
 *   pnpm migrate:catalog-positions --catalog ./data/catalog.json
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import { migrateCatalogToDetailPositions } from "../catalog/detailPositionsMigrate.js";

interface CliArgs {
  catalog: string;
  web: string;
}

function parseArgs(argv: string[]): CliArgs {
  let catalog = "./data/catalog.json";
  let web = "./apps/web/public/catalog.json";

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--catalog" && argv[i + 1]) catalog = argv[++i]!;
    else if (a === "--web" && argv[i + 1]) web = argv[++i]!;
  }

  return { catalog, web };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = resolve(args.catalog);
  const webPath = resolve(args.web);

  const raw = await readFile(catalogPath, "utf8");
  const catalog = hydrateCatalog(JSON.parse(raw) as SquadCatalog);
  const { catalog: migrated, stats } = migrateCatalogToDetailPositions(catalog);

  const json = JSON.stringify(migrated, null, 2);
  await writeFile(catalogPath, json, "utf8");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, json, "utf8");

  console.log(
    [
      `Detail position migration complete:`,
      `  players=${stats.players}`,
      `  naturalChanged=${stats.naturalChanged}`,
      `  positionsExpanded=${stats.positionsExpanded}`,
      `→ ${catalogPath}`,
      `→ ${webPath}`,
    ].join("\n"),
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
