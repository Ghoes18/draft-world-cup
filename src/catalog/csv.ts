/**
 * Minimal CSV reader for Fjelstul World Cup Database exports.
 */

import { readFile } from "node:fs/promises";

export type CsvRow = Record<string, string>;

/** Parse one CSV line (no embedded newlines; fields may be quoted). */
export function parseCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]!;
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out;
}

/** Read a CSV file into header-keyed row objects. */
export async function readCsvFile(path: string): Promise<CsvRow[]> {
  const text = await readFile(path, "utf8");
  const lines = text.split(/\r?\n/).filter((l) => l.length > 0);
  if (lines.length === 0) return [];

  const headers = parseCsvLine(lines[0]!);
  const rows: CsvRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const row: CsvRow = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]!] = cells[j] ?? "";
    }
    rows.push(row);
  }

  return rows;
}
