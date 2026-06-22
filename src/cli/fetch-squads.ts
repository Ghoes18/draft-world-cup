#!/usr/bin/env tsx
/**
 * Download live squad JSON files for every scenario slug.
 *
 * Usage:
 *   pnpm fetch:squads --base http://localhost:3000
 *   pnpm fetch:squads --port 3000
 *   SQUADS_API_BASE=http://localhost:3000 pnpm fetch:squads
 *
 * Fetches `{base}/squads/{slug}.json` for each slug from Fjelstul squads.csv
 * (or `--manifest` / `--catalog` scenario ids).
 *
 * Legal: only fetch from endpoints you are licensed to use.
 */

import { access, mkdir, readFile, writeFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import type { SquadCatalog } from "../catalog.js";
import {
  defaultFjelstulPaths,
  listFjelstulScenarioSlugs,
} from "../catalog/fjelstulImport.js";

interface CliArgs {
  base: string;
  out: string;
  fjelstul: string;
  catalog: string | null;
  manifest: string | null;
  concurrency: number;
  force: boolean;
  from: number;
  to: number;
}

function parseArgs(argv: string[]): CliArgs {
  let base = process.env.SQUADS_API_BASE?.trim() ?? "";
  let out = "./squads";
  let fjelstul = "./data/fjelstul";
  let catalog: string | null = null;
  let manifest: string | null = null;
  let concurrency = 8;
  let force = false;
  let from = 1930;
  let to = 2022;

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--base") {
      const next = argv[i + 1];
      if (!next || next.startsWith("--")) {
        console.error("Missing value for --base (origin URL, no trailing slash).");
        console.error("Local dev:  pnpm fetch:squads --port 3000");
        console.error("Or:         pnpm fetch:squads --base http://localhost:3000");
        console.error("Or set SQUADS_API_BASE in the environment.");
        process.exit(1);
      }
      base = argv[++i]!;
    } else if (a === "--port" && argv[i + 1]) {
      base = `http://localhost:${argv[++i]}`;
    }
    else if (a === "--out" && argv[i + 1]) out = argv[++i]!;
    else if (a === "--fjelstul" && argv[i + 1]) fjelstul = argv[++i]!;
    else if (a === "--catalog" && argv[i + 1]) catalog = argv[++i]!;
    else if (a === "--manifest" && argv[i + 1]) manifest = argv[++i]!;
    else if (a === "--concurrency" && argv[i + 1])
      concurrency = Math.max(1, Number(argv[++i]));
    else if (a === "--from" && argv[i + 1]) from = Number(argv[++i]);
    else if (a === "--to" && argv[i + 1]) to = Number(argv[++i]);
    else if (a === "--force") force = true;
  }

  return { base, out, fjelstul, catalog, manifest, concurrency, force, from, to };
}

async function fileExists(path: string): Promise<boolean> {
  try {
    await access(path);
    return true;
  } catch {
    return false;
  }
}

async function loadSlugsFromCatalog(path: string): Promise<string[]> {
  const text = await readFile(path, "utf8");
  const data = JSON.parse(text) as SquadCatalog;
  return data.scenarios.map((s) => s.id).sort();
}

async function loadSlugsFromManifest(path: string): Promise<string[]> {
  const text = await readFile(path, "utf8");
  const data = JSON.parse(text) as unknown;
  if (!Array.isArray(data)) {
    throw new Error(`Manifest must be a JSON array of slugs: ${path}`);
  }
  return data.map(String).sort();
}

async function resolveSlugs(args: CliArgs): Promise<string[]> {
  if (args.manifest) {
    return loadSlugsFromManifest(resolve(args.manifest));
  }
  if (args.catalog) {
    return loadSlugsFromCatalog(resolve(args.catalog));
  }

  const paths = defaultFjelstulPaths(resolve(args.fjelstul));
  if (!(await fileExists(paths.squads))) {
    console.error(`Missing ${paths.squads}`);
    console.error("Run pnpm build:catalog first or pass --catalog / --manifest.");
    process.exit(1);
  }

  return listFjelstulScenarioSlugs(paths.squads, {
    mensOnly: true,
    fromYear: args.from,
    toYear: args.to,
  });
}

async function fetchSquadJson(
  base: string,
  slug: string,
): Promise<{ ok: true; text: string } | { ok: false; status?: number; refused?: boolean }> {
  const url = `${base.replace(/\/$/, "")}/squads/${slug}.json`;
  try {
    const res = await fetch(url);
    if (!res.ok) {
      return { ok: false, status: res.status };
    }
    return { ok: true, text: await res.text() };
  } catch (err) {
    const code =
      err instanceof Error &&
      "cause" in err &&
      err.cause instanceof AggregateError &&
      err.cause.errors.some(
        (e) => e instanceof Error && "code" in e && e.code === "ECONNREFUSED",
      )
        ? "ECONNREFUSED"
        : err instanceof Error &&
            "code" in err &&
            (err as NodeJS.ErrnoException).code === "ECONNREFUSED"
          ? "ECONNREFUSED"
          : null;
    if (code === "ECONNREFUSED") {
      return { ok: false, refused: true };
    }
    throw err;
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (!args.base) {
    console.error("Missing API origin.");
    console.error("");
    console.error("Local Next.js dev (jogo live a correr noutro terminal):");
    console.error("  pnpm fetch:squads --port 3000");
    console.error("  pnpm fetch:squads --base http://localhost:3000");
    console.error("");
    console.error("Production / staging:");
    console.error("  pnpm fetch:squads --base https://your-game-domain");
    console.error("");
    console.error("Sem fetch — aponta import:squads à pasta public/squads do jogo:");
    console.error("  pnpm import:squads --dir /path/to/game/public/squads --overlay ./data/catalog.json");
    process.exit(1);
  }

  const slugs = await resolveSlugs(args);
  const outDir = resolve(args.out);
  await mkdir(outDir, { recursive: true });

  console.log(`Fetching ${slugs.length} squads from ${args.base} → ${outDir}`);

  const probe = await fetchSquadJson(args.base, slugs[0] ?? "brazil-1970");
  if (!probe.ok && probe.refused) {
    console.error("");
    console.error(`Cannot connect to ${args.base} (ECONNREFUSED).`);
    console.error("");
    console.error("Start the live 7a0 Next.js app first (the one with public/squads/), e.g.:");
    console.error("  cd /path/to/7a0-game && pnpm dev");
    console.error("");
    console.error("This repo's apps/web viewer does NOT serve /squads/ — only catalog.json.");
    console.error("If you already have squad JSON on disk, skip fetch and run:");
    console.error(
      "  pnpm import:squads --dir /path/to/game/public/squads --overlay ./data/catalog.json",
    );
    process.exit(1);
  }

  let downloaded = 0;
  let skipped = 0;
  let failed = 0;
  const failures: Array<{ slug: string; status?: number }> = [];

  for (let i = 0; i < slugs.length; i += args.concurrency) {
    const batch = slugs.slice(i, i + args.concurrency);
    const results = await Promise.all(
      batch.map(async (slug) => {
        const dest = join(outDir, `${slug}.json`);
        if (!args.force && (await fileExists(dest))) {
          return { slug, skipped: true as const };
        }

        const result = await fetchSquadJson(args.base, slug);
        if (!result.ok) {
          return {
            slug,
            skipped: false as const,
            ok: false,
            status: result.status,
          };
        }
        await writeFile(dest, result.text, "utf8");
        return { slug, skipped: false as const, ok: true };
      }),
    );

    for (const r of results) {
      if ("skipped" in r && r.skipped) {
        skipped++;
        continue;
      }
      if ("ok" in r && r.ok) {
        downloaded++;
      } else {
        failed++;
        failures.push(
          "status" in r && r.status !== undefined
            ? { slug: r.slug, status: r.status }
            : { slug: r.slug },
        );
      }
    }

    process.stderr.write(
      `  ${Math.min(i + args.concurrency, slugs.length)}/${slugs.length}\n`,
    );
  }

  console.log(
    `Done: ${downloaded} downloaded, ${skipped} skipped, ${failed} failed`,
  );
  if (failures.length > 0 && failures.length <= 20) {
    for (const f of failures) {
      console.warn(`  miss ${f.slug}${f.status ? ` (${f.status})` : ""}`);
    }
  } else if (failures.length > 20) {
    console.warn(
      `  first misses: ${failures
        .slice(0, 10)
        .map((f) => f.slug)
        .join(", ")}…`,
    );
  }

  if (downloaded === 0 && skipped === 0) {
    console.error(
      "No squad files saved. Check --base URL and slug path (/squads/{slug}.json).",
    );
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
