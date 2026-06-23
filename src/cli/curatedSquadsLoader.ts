/**
 * Load curated squad JSON exports from squads/curated/ (skips examples/).
 */

import { access, readdir, readFile } from "node:fs/promises";
import { join, resolve } from "node:path";
import { type RawCatalogExport } from "../catalog.js";
import { isRawCatalogExport } from "../catalog/liveImport.js";

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

/** Load autoral curated exports from a directory; returns [] if missing. */
export async function loadCuratedExportsFromDir(
  dir = "./squads/curated",
): Promise<RawCatalogExport[]> {
  const dirPath = resolve(dir);
  try {
    await access(dirPath);
  } catch {
    return [];
  }

  const exports: RawCatalogExport[] = [];
  for (const filePath of await listJsonFilesRecursive(dirPath)) {
    const data = JSON.parse(await readFile(filePath, "utf8")) as unknown;
    if (isRawCatalogExport(data)) exports.push(data);
  }
  return exports;
}
