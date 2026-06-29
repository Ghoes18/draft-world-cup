#!/usr/bin/env tsx
/**
 * Download Captain Tsubasa easter-egg portraits into the web app public folder.
 *
 * Usage:
 *   pnpm import:tsubasa
 *   pnpm import:tsubasa --size 512
 *   pnpm import:tsubasa --dry-run
 *
 * Images are fetched from the Captain Tsubasa Fandom wiki (MediaWiki API) and
 * saved as square WebP headshots at `apps/web/public/tsubasa/<id>.webp`.
 * Character art is copyrighted — see `data/tsubasa-photos.json` and the README
 * in the output folder; do not commit unless you have rights to redistribute.
 */

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";

const WIKI_API = "https://captaintsubasa.fandom.com/api.php";
const MANIFEST = resolve("data/tsubasa-photos.json");
const OUT_DIR = resolve("apps/web/public/tsubasa");

interface ManifestPlayer {
  wikiTitle: string;
  name: string;
}

interface Manifest {
  size: number;
  players: Record<string, ManifestPlayer>;
}

function parseArgs(argv: string[]): { size: number; dryRun: boolean } {
  let size = 256;
  let dryRun = false;
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "--size" && argv[i + 1]) size = Number(argv[++i]);
    if (arg === "--dry-run") dryRun = true;
  }
  return { size, dryRun };
}

async function wikiThumbUrl(title: string, width: number): Promise<string> {
  const params = new URLSearchParams({
    action: "query",
    titles: title,
    prop: "pageimages",
    pithumbsize: String(width),
    format: "json",
  });
  const res = await fetch(`${WIKI_API}?${params}`, {
    headers: { "User-Agent": "7a0-engine/import-tsubasa-photos" },
  });
  if (!res.ok) {
    throw new Error(`Wiki API ${res.status} for ${title}`);
  }
  const data = (await res.json()) as {
    query?: { pages?: Record<string, { thumbnail?: { source?: string } }> };
  };
  const page = Object.values(data.query?.pages ?? {})[0];
  const source = page?.thumbnail?.source;
  if (!source) {
    throw new Error(`No thumbnail for wiki page ${title}`);
  }
  return source;
}

async function downloadWebp(url: string): Promise<Buffer> {
  const res = await fetch(url, {
    headers: { "User-Agent": "7a0-engine/import-tsubasa-photos" },
  });
  if (!res.ok) {
    throw new Error(`Download failed ${res.status}: ${url}`);
  }
  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length < 200) {
    throw new Error(`Suspiciously small download (${buf.length} bytes): ${url}`);
  }
  return buf;
}

async function main(): Promise<void> {
  const { size, dryRun } = parseArgs(process.argv.slice(2));
  const manifestText = await readFile(MANIFEST, "utf8");
  const manifest = JSON.parse(manifestText) as Manifest;
  const thumbSize = size || manifest.size;

  if (!dryRun) {
    await mkdir(OUT_DIR, { recursive: true });
  }

  let ok = 0;
  for (const [id, player] of Object.entries(manifest.players)) {
    const outPath = resolve(OUT_DIR, `${id}.webp`);
    process.stdout.write(`${player.name} (${id})… `);
    const thumbUrl = await wikiThumbUrl(player.wikiTitle, thumbSize);
    if (dryRun) {
      console.log(`dry-run → ${thumbUrl}`);
      ok++;
      continue;
    }
    const image = await downloadWebp(thumbUrl);
    await writeFile(outPath, image);
    console.log(`→ ${outPath} (${image.length} bytes)`);
    ok++;
    await new Promise((r) => setTimeout(r, 300));
  }

  console.log(`\nDone: ${ok}/${Object.keys(manifest.players).length} portraits.`);
  if (!dryRun) {
    console.log(
      "Test in-game: set your name to Ghoes for a forced Captain Tsubasa first roll.",
    );
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
