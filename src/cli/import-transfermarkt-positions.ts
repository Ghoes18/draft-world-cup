#!/usr/bin/env tsx
/**
 * Enrich catalog positions from Transfermarkt (conservative overlay).
 *
 * Usage:
 *   pnpm import:transfermarkt-positions --catalog ./data/catalog.json
 *   pnpm import:transfermarkt-positions --team Brazil --from 1970 --to 1970 --limit 30
 *   pnpm import:transfermarkt-positions --apply --min-confidence 0.75
 *
 * Default is dry-run: writes overlay + report without modifying catalog.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import { defaultTransfermarktCacheDir } from "../catalog/transfermarktClient.js";
import {
  applyTransfermarktPositionOverlay,
  buildTransfermarktPositionOverlay,
  type TransfermarktImportReport,
} from "../catalog/transfermarktImport.js";

interface CliArgs {
  catalog: string;
  out: string;
  report: string;
  cache: string;
  from: number;
  to: number;
  team: string;
  limit: number | undefined;
  minConfidence: number;
  onlyInferred: boolean;
  apply: boolean;
  dryRun: boolean;
  skipProfileWhenConfident: boolean;
  delayMs: number;
}

function parseArgs(argv: string[]): CliArgs {
  let catalog = "./data/catalog.json";
  let out = "./data/transfermarkt/positions-overlay.json";
  let report = "./data/transfermarkt/positions-report.json";
  let cache = defaultTransfermarktCacheDir();
  let from = 1930;
  let to = 2022;
  let team = "";
  let limit: number | undefined;
  let minConfidence = 0.72;
  let onlyInferred = true;
  let apply = false;
  let dryRun = true;
  let skipProfileWhenConfident = true;
  let delayMs = 100;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--catalog" && argv[i + 1]) catalog = argv[++i]!;
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--report" && argv[i + 1]) report = argv[++i]!;
    else if (a === "--cache" && argv[i + 1]) cache = argv[++i]!;
    else if (a === "--from" && argv[i + 1]) from = Number(argv[++i]);
    else if (a === "--to" && argv[i + 1]) to = Number(argv[++i]);
    else if (a === "--team" && argv[i + 1]) team = argv[++i]!;
    else if (a === "--limit" && argv[i + 1]) limit = Number(argv[++i]);
    else if (a === "--min-confidence" && argv[i + 1]) {
      minConfidence = Number(argv[++i]);
    } else if (a === "--only-inferred") onlyInferred = true;
    else if (a === "--all-players") onlyInferred = false;
    else if (a === "--apply") {
      apply = true;
      dryRun = false;
    } else if (a === "--dry-run") dryRun = true;
    else if (a === "--full-profile") skipProfileWhenConfident = false;
    else if (a === "--delay-ms" && argv[i + 1]) delayMs = Number(argv[++i]);
  }

  return {
    catalog,
    out,
    report,
    cache,
    from,
    to,
    team,
    limit,
    minConfidence,
    onlyInferred,
    apply,
    dryRun,
    skipProfileWhenConfident,
    delayMs,
  };
}

async function loadCatalog(path: string): Promise<SquadCatalog> {
  const text = await readFile(path, "utf8");
  return hydrateCatalog(JSON.parse(text) as SquadCatalog);
}

async function writeJson(path: string, data: unknown): Promise<void> {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, JSON.stringify(data, null, 2), "utf8");
}

function summarizeReport(report: TransfermarktImportReport): void {
  console.log(
    [
      `Transfermarkt position overlay:`,
      `  candidates=${report.candidatesConsidered}`,
      `  patched=${report.patched}`,
      `  skipped=${report.skipped}`,
      `  lowConfidence=${report.lowConfidence}`,
      `  ambiguous=${report.ambiguous}`,
      `  unmatched=${report.unmatched}`,
      `  genericPosition=${report.genericPosition}`,
      `  searchOnly=${report.searchOnly}`,
      `  overlayScenarios=${report.overlay.scenarios.length}`,
    ].join("\n"),
  );
  if (report.candidatesConsidered === 0) {
    console.log(
      "No eligible candidates in range. Fine curated/API positions are skipped by default.",
    );
    console.log("Use --all-players to force, or narrow with --team/--from/--to.");
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const catalogPath = resolve(args.catalog);

  try {
    await access(catalogPath);
  } catch {
    console.error(`Catalog not found: ${catalogPath}`);
    process.exit(1);
  }

  const catalog = await loadCatalog(catalogPath);
  const startedAt = Date.now();
  const report = await buildTransfermarktPositionOverlay(catalog, {
    fromYear: args.from,
    toYear: args.to,
    ...(args.team ? { team: args.team } : {}),
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    minConfidence: args.minConfidence,
    onlyInferred: args.onlyInferred,
    cacheDir: resolve(args.cache),
    delayMs: args.delayMs,
    skipProfileWhenConfident: args.skipProfileWhenConfident,
    requestTimeoutMs: 45_000,
    onProgress: (progress) => {
      if (progress.processing) {
        console.error(
          `… still working on ${progress.catalogName} (${progress.team} ${progress.cup}) [${progress.index}/${progress.total}]`,
        );
        return;
      }
      const interval = progress.total >= 200 ? 10 : 25;
      const { index, total } = progress;
      if (index !== 1 && index % interval !== 0 && index !== total) return;
      const elapsedSec = (Date.now() - startedAt) / 1000;
      const rate = index / Math.max(elapsedSec, 0.001);
      const etaSec = rate > 0 ? Math.round((total - index) / rate) : 0;
      const eta =
        etaSec >= 60
          ? `~${Math.floor(etaSec / 60)}m${etaSec % 60}s left`
          : etaSec > 0
            ? `~${etaSec}s left`
            : "";
      console.error(
        `[${index}/${total}] ${progress.catalogName} (${progress.team} ${progress.cup}) → ${progress.status}${eta ? ` | ${eta}` : ""}`,
      );
    },
  });

  const outPath = resolve(args.out);
  const reportPath = resolve(args.report);
  await writeJson(outPath, report.overlay);
  await writeJson(reportPath, {
    summary: {
      candidatesConsidered: report.candidatesConsidered,
      patched: report.patched,
      skipped: report.skipped,
      lowConfidence: report.lowConfidence,
      ambiguous: report.ambiguous,
      unmatched: report.unmatched,
      genericPosition: report.genericPosition,
      searchOnly: report.searchOnly,
    },
    entries: report.entries,
  });

  summarizeReport(report);
  console.log(`Overlay → ${outPath}`);
  console.log(`Report → ${reportPath}`);

  if (args.dryRun && !args.apply) {
    console.log("Dry-run only. Pass --apply to write catalog changes.");
    return;
  }

  const applied = applyTransfermarktPositionOverlay(catalog, report.overlay);
  const catalogJson = JSON.stringify(applied.catalog, null, 2);
  await writeFile(catalogPath, catalogJson, "utf8");

  const webPath = resolve("apps/web/public/catalog.json");
  await mkdir(dirname(webPath), { recursive: true });
  await writeFile(webPath, catalogJson, "utf8");

  console.log(
    `Applied ${applied.patched} position patches (${applied.skipped} skipped) → ${catalogPath}`,
  );
  console.log(`Web viewer copy → ${webPath}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
