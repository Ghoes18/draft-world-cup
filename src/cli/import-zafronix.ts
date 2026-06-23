#!/usr/bin/env tsx
/**
 * Enrich catalog with Zafronix World Cup roster data (appearances, goals, positions).
 *
 * Usage:
 *   pnpm build:catalog
 *   ZAFRONIX_API_KEY=… pnpm import:zafronix --from 1930 --to 1969
 *   pnpm import:zafronix --overlay ./data/catalog.json --from 1930 --to 1969
 *
 * Precedence: heuristic Fjelstul base < Zafronix < import:external < import:squads (curated).
 *
 * API: https://api.zafronix.com/docs
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import { overlayRawExportOnCatalog } from "../catalog/catalogOverlay.js";
import { buildZafronixRawExport } from "../catalog/zafronixImport.js";
import {
  loadZafronixTournaments,
  resolveZafronixApiKey,
  type ZafronixClientOptions,
} from "../catalog/zafronixClient.js";

interface CliArgs {
  overlay: string;
  out: string;
  cache: string;
  from: number;
  to: number;
  careerFrom: number;
  apiKey: string;
  skipFetch: boolean;
}

function parseArgs(argv: string[]): CliArgs {
  let overlay = "./data/catalog.json";
  let out = "./data/catalog.json";
  let cache = "./data/zafronix";
  let from = 1930;
  let to = 1969;
  let careerFrom = 1930;
  let apiKey = "";
  let skipFetch = false;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--overlay" && argv[i + 1]) overlay = argv[++i]!;
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--cache" && argv[i + 1]) cache = argv[++i]!;
    else if (a === "--from" && argv[i + 1]) from = Number(argv[++i]);
    else if (a === "--to" && argv[i + 1]) to = Number(argv[++i]);
    else if (a === "--career-from" && argv[i + 1]) {
      careerFrom = Number(argv[++i]);
    } else if (a === "--api-key" && argv[i + 1]) apiKey = argv[++i]!;
    else if (a === "--skip-fetch") skipFetch = true;
  }

  return { overlay, out, cache, from, to, careerFrom, apiKey, skipFetch };
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
  const args = parseArgs(process.argv.slice(2));
  const overlayPath = resolve(args.overlay);
  const outPath = resolve(args.out);
  const cacheDir = resolve(args.cache);

  try {
    await access(overlayPath);
  } catch {
    console.error(`Catalog not found: ${overlayPath}`);
    console.error("Run pnpm build:catalog first.");
    process.exit(1);
  }

  const clientOptions: ZafronixClientOptions = {
    apiKey: resolveZafronixApiKey(args.apiKey || undefined, {
      allowCacheOnly: args.skipFetch,
    }),
    cacheDir,
  };

  if (args.skipFetch) {
    clientOptions.fetchImpl = async () => {
      throw new Error("Network fetch disabled (--skip-fetch) and cache miss");
    };
  }

  console.log(
    `Fetching Zafronix tournaments ${args.careerFrom}–${args.to} (patch ${args.from}–${args.to})…`,
  );

  const tournaments = await loadZafronixTournaments(
    clientOptions,
    args.careerFrom,
    args.to,
  );

  if (tournaments.size === 0) {
    console.error("No Zafronix tournament data loaded. Check API key and year range.");
    process.exit(1);
  }

  const base = await loadCatalog(overlayPath);
  const { raw, stats } = buildZafronixRawExport(base, tournaments, {
    fromYear: args.from,
    toYear: args.to,
    careerFromYear: args.careerFrom,
  });

  const result = overlayRawExportOnCatalog(base, [raw]);
  await writeCatalog(result.catalog, outPath);

  console.log(
    `Zafronix overlay: ${result.patched} catalog players patched, ${result.unmatched} overlay rows unmatched`,
  );
  console.log(
    `Zafronix stats: ${stats.scenariosWithData}/${stats.scenariosConsidered} scenarios with roster data, ${stats.playersPatched} roster rows processed`,
  );
  console.log(
    `Wrote ${result.catalog.scenarios.length} scenarios, ${Object.keys(result.catalog.players).length} players → ${outPath}`,
  );
  console.log(`Web viewer copy → ${resolve("apps/web/public/catalog.json")}`);
  console.log(`Cache → ${cacheDir}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
