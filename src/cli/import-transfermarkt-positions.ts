#!/usr/bin/env tsx
/**
 * Enrich catalog positions from Transfermarkt (conservative overlay).
 *
 * Usage:
 *   pnpm import:transfermarkt-positions --catalog ./data/catalog.json
 *   pnpm import:transfermarkt-positions --team Brazil --from 1970 --to 1970
 *   pnpm import:transfermarkt-positions --apply --min-confidence 0.75
 *
 * Fast path for all players: pnpm migrate:catalog-positions (no API).
 * Default eligibility is inferred-only (~100 players). --all-players adds
 * ambiguous central naturals, not the full 11k roster.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { hydrateCatalog, type SquadCatalog } from "../catalog.js";
import { defaultTransfermarktCacheDir } from "../catalog/transfermarktClient.js";
import {
  applyTransfermarktPositionOverlay,
  buildTransfermarktPositionOverlay,
  countTransfermarktEligibility,
  type TransfermarktEligibilityMode,
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
  eligibility: TransfermarktEligibilityMode;
  force: boolean;
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
  let eligibility: TransfermarktEligibilityMode = "inferred";
  let force = false;
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
    } else if (a === "--only-inferred") eligibility = "inferred";
    else if (a === "--all-players" || a === "--ambiguous") {
      eligibility = "ambiguous";
    } else if (a === "--force") {
      force = true;
      eligibility = "force";
    } else if (a === "--apply") {
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
    eligibility,
    force,
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

function formatEta(seconds: number): string {
  if (seconds <= 0) return "";
  if (seconds < 90) return `~${seconds}s left`;
  const minutes = Math.round(seconds / 60);
  if (minutes < 120) return `~${minutes}m left`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `~${hours}h${rem > 0 ? `${rem}m` : ""} left`;
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
      "No eligible candidates. Side-aware players are skipped — use pnpm migrate:catalog-positions for the full catalog.",
    );
    console.log("Try --ambiguous for central naturals only, or --force to re-import everyone.");
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
  const preview = countTransfermarktEligibility(catalog, {
    fromYear: args.from,
    toYear: args.to,
    ...(args.team ? { team: args.team } : {}),
    eligibility: args.eligibility,
    force: args.force,
  });

  console.error(
    `Eligibility: ${preview.eligible} to query, ${preview.skipped} skipped (mode=${preview.mode}).`,
  );
  if (preview.eligible > 800 && preview.mode !== "inferred") {
    console.error(
      "Large batch — narrow with --from/--to/--team, or use pnpm migrate:catalog-positions first.",
    );
  }

  const startedAt = Date.now();
  const recentDurations: number[] = [];
  let lastIndex = 0;
  let lastTickAt = startedAt;

  const report = await buildTransfermarktPositionOverlay(catalog, {
    fromYear: args.from,
    toYear: args.to,
    ...(args.team ? { team: args.team } : {}),
    ...(args.limit !== undefined ? { limit: args.limit } : {}),
    minConfidence: args.minConfidence,
    eligibility: args.eligibility,
    force: args.force,
    cacheDir: resolve(args.cache),
    delayMs: args.delayMs,
    skipProfileWhenConfident: args.skipProfileWhenConfident,
    searchOnlyMinConfidence: args.minConfidence,
    requestTimeoutMs: 20_000,
    onProgress: (progress) => {
      if (progress.processing) {
        console.error(
          `… still working on ${progress.catalogName} (${progress.team} ${progress.cup}) [${progress.index}/${progress.total}]`,
        );
        return;
      }

      const now = Date.now();
      if (progress.index > lastIndex) {
        recentDurations.push(now - lastTickAt);
        if (recentDurations.length > 40) recentDurations.shift();
        lastIndex = progress.index;
        lastTickAt = now;
      }

      const interval = progress.total >= 200 ? 10 : 25;
      const { index, total } = progress;
      if (index !== 1 && index % interval !== 0 && index !== total) return;

      const avgMs =
        recentDurations.length > 0
          ? recentDurations.reduce((a, b) => a + b, 0) / recentDurations.length
          : now - startedAt;
      const etaSec = Math.round(((total - index) * avgMs) / 1000);
      const eta = formatEta(etaSec);

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
