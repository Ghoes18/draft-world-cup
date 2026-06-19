#!/usr/bin/env tsx
/**
 * Import squad JSON files into a normalized catalog (forces in clear text).
 *
 * Usage:
 *   pnpm import:squads --dir ./squads --out ./data/catalog.json
 *
 * Accepts:
 * - Live 7a0 format: { sel, copa, squad: [{ id, name, pos, f }] }
 * - Autoral format:  { scenarios: [...] }
 *
 * Legal: only import files you are licensed to use. No automatic fetch from 7a0.com.br.
 */

import { access, mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { normalizeCatalog, type LiveSquadJson, type RawCatalogExport } from "../catalog.js";
import {
  catalogFromLiveSquads,
  isLiveSquadJson,
  isRawCatalogExport,
} from "../catalog/liveImport.js";

function parseArgs(argv: string[]): { dir: string; out: string } {
  let dir = "./squads";
  let out = "./data/catalog.json";
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === "--dir" && argv[i + 1]) dir = argv[++i]!;
    if (argv[i] === "--out" && argv[i + 1]) out = argv[++i]!;
  }
  return { dir, out };
}

async function loadJson(path: string): Promise<unknown> {
  const text = await readFile(path, "utf8");
  return JSON.parse(text) as unknown;
}

async function main() {
  const { dir, out } = parseArgs(process.argv.slice(2));
  const dirPath = resolve(dir);

  try {
    await access(dirPath);
  } catch {
    console.error(`Directory not found: ${dirPath}`);
    console.error("");
    console.error("Create it and add squad JSON files, for example:");
    console.error(`  mkdir -p ${dir}`);
    console.error(`  # live 7a0:  { "sel": "Brasil", "copa": 1970, "squad": [...] }`);
    console.error(`  # autoral:   { "scenarios": [ { "id", "team", "cup", "players": [...] } ] }`);
    console.error("");
    console.error("See squads/README.md for details.");
    process.exit(1);
  }

  const files = (await readdir(dirPath)).filter((f) => f.endsWith(".json"));
  if (files.length === 0) {
    console.error(`No JSON files in ${dirPath}`);
    console.error("Add *.json squad files (see squads/README.md).");
    process.exit(1);
  }

  const liveSquads: LiveSquadJson[] = [];
  let autoral: RawCatalogExport | null = null;

  for (const file of files) {
    const data = await loadJson(join(dirPath, file));
    if (isLiveSquadJson(data)) {
      liveSquads.push(data);
    } else if (isRawCatalogExport(data)) {
      autoral = data;
    } else {
      console.warn(`Skipping unrecognized format: ${file}`);
    }
  }

  let catalog;
  if (autoral) {
    catalog = normalizeCatalog(autoral);
  } else if (liveSquads.length > 0) {
    catalog = catalogFromLiveSquads(liveSquads);
  } else {
    console.error("No valid squad files found.");
    process.exit(1);
  }

  await mkdir(dirname(out), { recursive: true });
  await writeFile(out, JSON.stringify(catalog, null, 2), "utf8");
  console.log(
    `Wrote ${catalog.scenarios.length} scenarios, ${Object.keys(catalog.players).length} players → ${out}`,
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
