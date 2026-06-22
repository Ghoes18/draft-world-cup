/**
 * Parse external CSV ratings and match onto Fjelstul catalog scenarios.
 *
 * Expected columns: name, year, team, overall, positions
 * (positions: slash- or comma-separated formation codes)
 */

import {
  scenarioIdFromTeamCup,
  type RawCatalogExport,
} from "../catalog.js";
import { parseCsvLine } from "./csv.js";

export interface ExternalRatingRow {
  name: string;
  year: number;
  team: string;
  overall: number;
  positions: string[];
}

function normalizeHeader(h: string): string {
  return h.trim().toLowerCase().replace(/\s+/g, "_");
}

function parsePositionsField(raw: string): string[] {
  if (!raw.trim()) return [];
  return [
    ...new Set(
      raw
        .split(/[/,|]/)
        .map((p) => p.trim().toUpperCase())
        .filter(Boolean),
    ),
  ];
}

function parseOverall(raw: string): number | null {
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  return Math.round(Math.min(100, Math.max(0, n)));
}

/** Parse external ratings CSV text into rows. */
export function parseExternalRatingsCsv(text: string): ExternalRatingRow[] {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = parseCsvLine(lines[0]!).map(normalizeHeader);
  const nameIdx = headers.indexOf("name");
  const yearIdx = headers.findIndex((h) => h === "year" || h === "cup");
  const teamIdx = headers.indexOf("team");
  const overallIdx = headers.findIndex(
    (h) => h === "overall" || h === "rating" || h === "ovr",
  );
  const posIdx = headers.findIndex(
    (h) => h === "positions" || h === "position" || h === "playable_positions",
  );

  if (nameIdx < 0 || yearIdx < 0 || teamIdx < 0 || overallIdx < 0) {
    throw new Error(
      "CSV must include name, year (or cup), team, and overall (or rating) columns",
    );
  }

  const rows: ExternalRatingRow[] = [];

  for (let i = 1; i < lines.length; i++) {
    const cells = parseCsvLine(lines[i]!);
    const name = cells[nameIdx]?.trim();
    const year = Number(cells[yearIdx]);
    const team = cells[teamIdx]?.trim();
    const overall = parseOverall(cells[overallIdx] ?? "");
    if (!name || !team || !Number.isFinite(year) || overall === null) continue;

    const positions =
      posIdx >= 0 ? parsePositionsField(cells[posIdx] ?? "") : [];

    rows.push({ name, year, team, overall, positions });
  }

  return rows;
}

/** Group external rows into a RawCatalogExport for overlay merge. */
export function externalRowsToRawExport(
  rows: readonly ExternalRatingRow[],
): RawCatalogExport {
  const groups = new Map<
    string,
    RawCatalogExport["scenarios"][number]
  >();

  for (const row of rows) {
    const id = scenarioIdFromTeamCup(row.team, row.year);
    const scenario =
      groups.get(id) ??
      ({
        id,
        team: row.team,
        cup: row.year,
        players: [],
      } satisfies RawCatalogExport["scenarios"][number]);

    const naturalPosition = row.positions[0] ?? "CM";
    scenario.players.push({
      id: `${id}__ext-${normalizeExternalKey(row.name)}`,
      name: row.name,
      naturalPosition,
      overall: row.overall,
      force: Math.round((row.overall / 100) * 255),
      ...(row.positions.length > 0
        ? { positions: row.positions, positionSource: "api" as const }
        : {}),
    });

    groups.set(id, scenario);
  }

  return {
    scenarios: [...groups.values()].sort(
      (a, b) => a.cup - b.cup || a.team.localeCompare(b.team),
    ),
  };
}

function normalizeExternalKey(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}
