/**
 * Build a squad catalog from the Fjelstul World Cup Database (CC-BY-SA 4.0).
 *
 * https://github.com/jfjelstul/worldcup
 *
 * Covers men's FIFA World Cups 1930–2022. Player `force` values are autoral
 * (derived from appearances + goals), not live 7a0 ratings.
 */

import {
  scenarioIdFromTeamCup,
  type RawCatalogExport,
  normalizeCatalog,
  type SquadCatalog,
} from "../catalog.js";
import { readCsvFile, type CsvRow } from "./csv.js";
import {
  appearanceMerit,
  meritsToForces,
  type PlayerAppearanceStats,
} from "./deriveForce.js";

const FJELSTUL_BASE =
  "https://raw.githubusercontent.com/jfjelstul/worldcup/master/data-csv";

export const FJELSTUL_FILES = [
  "squads.csv",
  "player_appearances.csv",
  "goals.csv",
  "tournaments.csv",
] as const;

export interface FjelstulImportOptions {
  /** Only men's World Cup tournaments (default true). */
  mensOnly?: boolean;
  /** Inclusive first tournament year (default 1930). */
  fromYear?: number;
  /** Inclusive last tournament year (default 2022). */
  toYear?: number;
}

export interface FjelstulPaths {
  squads: string;
  playerAppearances: string;
  goals: string;
  tournaments: string;
}

function parseYear(tournamentName: string): number | null {
  const m = /^(\d{4})\s/.exec(tournamentName);
  return m ? Number(m[1]) : null;
}

function isMensTournament(tournamentName: string): boolean {
  return tournamentName.includes("Men's");
}

function mapPositionCode(code: string): string {
  switch (code.trim().toUpperCase()) {
    case "GK":
      return "GK";
    case "DF":
      return "CB";
    case "MF":
      return "CM";
    case "FW":
      return "ST";
    default:
      return "CM";
  }
}

function playerDisplayName(given: string, family: string): string {
  const g = given.trim();
  const f = family.trim();
  if (g && f) return `${g} ${f}`;
  return g || f || "Unknown";
}

function squadPlayerKey(
  tournamentId: string,
  teamId: string,
  playerId: string,
): string {
  return `${tournamentId}|${teamId}|${playerId}`;
}

function catalogPlayerId(scenarioId: string, playerId: string): string {
  return `${scenarioId}__${playerId.replace(/^P-/, "p-")}`;
}

function emptyStats(): PlayerAppearanceStats {
  return { starts: 0, subs: 0, goals: 0 };
}

/** Index appearance stats by tournament + team + player. */
export function indexAppearances(rows: CsvRow[]): Map<string, PlayerAppearanceStats> {
  const map = new Map<string, PlayerAppearanceStats>();

  for (const row of rows) {
    const key = squadPlayerKey(row.tournament_id!, row.team_id!, row.player_id!);
    const stats = map.get(key) ?? emptyStats();
    if (row.starter === "1") stats.starts += 1;
    if (row.substitute === "1") stats.subs += 1;
    map.set(key, stats);
  }

  return map;
}

/** Add goal counts (non-own-goals) to appearance stats. */
export function addGoalCounts(
  stats: Map<string, PlayerAppearanceStats>,
  goalRows: CsvRow[],
): void {
  for (const row of goalRows) {
    if (row.own_goal === "1") continue;
    const key = squadPlayerKey(
      row.tournament_id!,
      row.player_team_id ?? row.team_id!,
      row.player_id!,
    );
    const s = stats.get(key) ?? emptyStats();
    s.goals += 1;
    stats.set(key, s);
  }
}

/** Filter squad rows to men's tournaments in the year range. */
export function filterSquadRows(
  rows: CsvRow[],
  opts: Required<FjelstulImportOptions>,
): CsvRow[] {
  return rows.filter((row) => {
    const name = row.tournament_name ?? "";
    if (opts.mensOnly && !isMensTournament(name)) return false;
    const year = parseYear(name);
    if (year === null) return false;
    return year >= opts.fromYear && year <= opts.toYear;
  });
}

/** Build raw catalog export from Fjelstul CSV paths. */
export async function buildCatalogFromFjelstul(
  paths: FjelstulPaths,
  options: FjelstulImportOptions = {},
): Promise<RawCatalogExport> {
  const opts: Required<FjelstulImportOptions> = {
    mensOnly: options.mensOnly ?? true,
    fromYear: options.fromYear ?? 1930,
    toYear: options.toYear ?? 2022,
  };

  const [squads, appearances, goals] = await Promise.all([
    readCsvFile(paths.squads),
    readCsvFile(paths.playerAppearances),
    readCsvFile(paths.goals),
  ]);

  const squadRows = filterSquadRows(squads, opts);

  const stats = indexAppearances(
    appearances.filter((r) => {
      const name = r.tournament_name ?? "";
      if (opts.mensOnly && !isMensTournament(name)) return false;
      const year = parseYear(name);
      return year !== null && year >= opts.fromYear && year <= opts.toYear;
    }),
  );
  addGoalCounts(
    stats,
    goals.filter((r) => {
      const name = r.tournament_name ?? "";
      if (opts.mensOnly && !isMensTournament(name)) return false;
      const year = parseYear(name);
      return year !== null && year >= opts.fromYear && year <= opts.toYear;
    }),
  );

  /** Group squad rows by (team, cup). */
  const groups = new Map<string, CsvRow[]>();
  for (const row of squadRows) {
    const year = parseYear(row.tournament_name ?? "");
    if (year === null) continue;
    const team = row.team_name ?? "Unknown";
    const groupKey = `${team}\0${year}`;
    const list = groups.get(groupKey) ?? [];
    list.push(row);
    groups.set(groupKey, list);
  }

  const scenarios: RawCatalogExport["scenarios"] = [];

  for (const [groupKey, members] of groups) {
    const [team, yearStr] = groupKey.split("\0");
    const cup = Number(yearStr);
    const scenarioId = scenarioIdFromTeamCup(team!, cup);
    const sample = members[0]!;
    const tournamentId = sample.tournament_id!;
    const teamId = sample.team_id!;

    const merits = new Map<string, number>();
    for (const row of members) {
      const key = squadPlayerKey(tournamentId, teamId, row.player_id!);
      merits.set(key, appearanceMerit(stats.get(key) ?? emptyStats()));
    }

    const forces = meritsToForces(merits, (k) => k);

    const players = members.map((row) => {
      const key = squadPlayerKey(tournamentId, teamId, row.player_id!);
      const shirtRaw = Number(row.shirt_number);
      const shirtNumber =
        Number.isFinite(shirtRaw) && shirtRaw > 0 ? shirtRaw : undefined;

      return {
        id: catalogPlayerId(scenarioId, row.player_id!),
        name: playerDisplayName(row.given_name ?? "", row.family_name ?? ""),
        naturalPosition: mapPositionCode(row.position_code ?? "MF"),
        force: forces.get(key) ?? 160,
        ...(shirtNumber !== undefined ? { shirtNumber } : {}),
      };
    });

    scenarios.push({
      id: scenarioId,
      team: team!,
      cup,
      players,
    });
  }

  scenarios.sort((a, b) => a.cup - b.cup || a.team.localeCompare(b.team));

  return { scenarios };
}

/** Normalize Fjelstul CSVs into a `SquadCatalog`. */
export async function catalogFromFjelstul(
  paths: FjelstulPaths,
  options?: FjelstulImportOptions,
): Promise<SquadCatalog> {
  const raw = await buildCatalogFromFjelstul(paths, options);
  return normalizeCatalog(raw);
}

export function fjelstulDownloadUrl(file: string): string {
  return `${FJELSTUL_BASE}/${file}`;
}

export function defaultFjelstulPaths(cacheDir: string): FjelstulPaths {
  const join = (f: string) => `${cacheDir.replace(/\/$/, "")}/${f}`;
  return {
    squads: join("squads.csv"),
    playerAppearances: join("player_appearances.csv"),
    goals: join("goals.csv"),
    tournaments: join("tournaments.csv"),
  };
}
