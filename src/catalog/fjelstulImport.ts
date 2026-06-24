/**
 * Build a squad catalog from the Fjelstul World Cup Database (CC-BY-SA 4.0).
 *
 * https://github.com/jfjelstul/worldcup
 *
 * Covers men's FIFA World Cups 1930–2022. Player `force` values are autoral
 * (derived from appearances + goals), not live 7a0 ratings.
 */

import { positionCodesFromFjelstul } from "../playerPositions.js";
import { canonicalRole } from "../chemistry.js";
import { playerDisplayNameFromParts } from "../playerNames.js";
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
import {
  finalizePlayerOverall,
  isFinalStage,
  isKnockoutStage,
  isSemiOrBetterStage,
  type CareerOverallInput,
  type CareerPedigreeInput,
} from "./deriveOverall.js";

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

/** Collect per-match Fjelstul position_code counts per squad player. */
export function indexAppearancePositionCounts(
  rows: CsvRow[],
): Map<string, Map<string, number>> {
  const map = new Map<string, Map<string, number>>();
  for (const row of rows) {
    const key = squadPlayerKey(row.tournament_id!, row.team_id!, row.player_id!);
    const code = (row.position_code ?? "MF").trim().toUpperCase();
    const counts = map.get(key) ?? new Map<string, number>();
    counts.set(code, (counts.get(code) ?? 0) + 1);
    map.set(key, counts);
  }
  return map;
}

/** Collect unique raw Fjelstul position codes per squad player from appearances. */
export function indexAppearancePositions(
  rows: CsvRow[],
): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const [key, counts] of indexAppearancePositionCounts(rows)) {
    map.set(key, new Set(counts.keys()));
  }
  return map;
}

const COARSE_FJELSTUL_CODES = new Set(["GK", "DF", "MF", "FW"]);

function isDefenderFineCode(code: string): boolean {
  const role = canonicalRole(code);
  return role === "CB" || role === "FB";
}

function normalizeDefenderNaturalCode(code: string): string {
  const upper = code.trim().toUpperCase();
  if (upper === "SW") return "CB";
  return upper;
}

/**
 * Pick naturalPosition for a squad-listed DF from appearance counts.
 * Playable positions stay on the coarse DF expansion; this only labels the card.
 */
export function resolveDefenderNaturalPosition(
  appearanceCounts: Map<string, number> | undefined,
): string {
  if (!appearanceCounts || appearanceCounts.size === 0) return "CB";

  const fineEntries: { code: string; count: number }[] = [];
  for (const [code, count] of appearanceCounts) {
    const upper = code.trim().toUpperCase();
    if (COARSE_FJELSTUL_CODES.has(upper)) continue;
    if (!isDefenderFineCode(upper)) continue;
    fineEntries.push({ code: upper, count });
  }

  if (fineEntries.length === 0) return "CB";

  fineEntries.sort(
    (a, b) => b.count - a.count || a.code.localeCompare(b.code),
  );
  return normalizeDefenderNaturalCode(fineEntries[0]!.code);
}

function playerDisplayName(given: string, family: string): string {
  return playerDisplayNameFromParts(given, family);
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

function uniqueExpanded(codes: string[]): string[] {
  return [...new Set(codes.map((c) => c.trim().toUpperCase()))].sort();
}

function emptyStats(): PlayerAppearanceStats {
  return { starts: 0, subs: 0, goals: 0 };
}

interface EnhancedAppearanceStats extends PlayerAppearanceStats {
  knockoutGoals: number;
  finalGoals: number;
}

function emptyEnhancedStats(): EnhancedAppearanceStats {
  return { starts: 0, subs: 0, goals: 0, knockoutGoals: 0, finalGoals: 0 };
}

interface TournamentContext {
  winnerById: Map<string, string>;
  winnerByYear: Map<number, string>;
}

/** Teams that played in the final of each tournament. */
export function indexFinalists(rows: CsvRow[]): Map<string, Set<string>> {
  const map = new Map<string, Set<string>>();
  for (const row of rows) {
    const stage = row.stage_name ?? "";
    if (!isFinalStage(stage)) continue;
    const tid = row.tournament_id!;
    const teamId = row.team_id!;
    const set = map.get(tid) ?? new Set<string>();
    set.add(teamId);
    map.set(tid, set);
  }
  return map;
}

/** Distinct World Cups per player_id (career longevity). */
export function indexPlayerWorldCupCount(rows: CsvRow[]): Map<string, number> {
  const cupsByPlayer = new Map<string, Set<string>>();
  for (const row of rows) {
    const pid = row.player_id!;
    const tid = row.tournament_id!;
    const set = cupsByPlayer.get(pid) ?? new Set<string>();
    set.add(tid);
    cupsByPlayer.set(pid, set);
  }
  const counts = new Map<string, number>();
  for (const [pid, set] of cupsByPlayer) {
    counts.set(pid, set.size);
  }
  return counts;
}

function loadTournamentContext(rows: CsvRow[]): TournamentContext {
  const winnerById = new Map<string, string>();
  const winnerByYear = new Map<number, string>();
  for (const row of rows) {
    const tid = row.tournament_id!;
    const year = Number(row.year);
    const winner = row.winner?.trim();
    if (winner) {
      winnerById.set(tid, winner);
      if (Number.isFinite(year)) winnerByYear.set(year, winner);
    }
  }
  return { winnerById, winnerByYear };
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

/** Add goal counts (non-own-goals) with knockout/final breakdown. */
export function addGoalCounts(
  stats: Map<string, EnhancedAppearanceStats>,
  goalRows: CsvRow[],
): void {
  for (const row of goalRows) {
    if (row.own_goal === "1") continue;
    const key = squadPlayerKey(
      row.tournament_id!,
      row.player_team_id ?? row.team_id!,
      row.player_id!,
    );
    const s = stats.get(key) ?? emptyEnhancedStats();
    s.goals += 1;
    const stage = row.stage_name ?? "";
    if (isKnockoutStage(stage)) s.knockoutGoals += 1;
    if (isFinalStage(stage)) s.finalGoals += 1;
    stats.set(key, s);
  }
}

/** Build enhanced stats map (appearances + goals). */
export function buildEnhancedStats(
  appearanceRows: CsvRow[],
  goalRows: CsvRow[],
): Map<string, EnhancedAppearanceStats> {
  const map = new Map<string, EnhancedAppearanceStats>();
  for (const row of appearanceRows) {
    const key = squadPlayerKey(row.tournament_id!, row.team_id!, row.player_id!);
    const stats = map.get(key) ?? emptyEnhancedStats();
    if (row.starter === "1") stats.starts += 1;
    if (row.substitute === "1") stats.subs += 1;
    map.set(key, stats);
  }
  addGoalCounts(map, goalRows);
  return map;
}

/** tournament_id → calendar year (from squad / appearance rows). */
export function indexTournamentYears(rows: CsvRow[]): Map<string, number> {
  const map = new Map<string, number>();
  for (const row of rows) {
    const tid = row.tournament_id;
    if (!tid) continue;
    const year = parseYear(row.tournament_name ?? "");
    if (year !== null) map.set(tid, year);
  }
  return map;
}

/** Best knockout stage reached per (tournament_id, team_id). */
export function indexTeamKnockoutDepth(
  rows: CsvRow[],
): Map<string, "semi" | "final"> {
  const depth = new Map<string, "semi" | "final">();
  for (const row of rows) {
    const stage = row.stage_name ?? "";
    const key = `${row.tournament_id}|${row.team_id}`;
    if (isFinalStage(stage)) {
      depth.set(key, "final");
      continue;
    }
    if (isSemiOrBetterStage(stage) && depth.get(key) !== "final") {
      depth.set(key, "semi");
    }
  }
  return depth;
}

interface PlayerCareerRollup {
  starts: number;
  subs: number;
  goals: number;
  knockoutGoals: number;
  finalGoals: number;
  worldCupsPlayed: number;
  everWonCup: boolean;
  everReachedFinal: boolean;
  everReachedSemiOrBetter: boolean;
}

function emptyCareerRollup(): PlayerCareerRollup {
  return {
    starts: 0,
    subs: 0,
    goals: 0,
    knockoutGoals: 0,
    finalGoals: 0,
    worldCupsPlayed: 0,
    everWonCup: false,
    everReachedFinal: false,
    everReachedSemiOrBetter: false,
  };
}

/** Per-player WC career rollup up to `maxYear` (inclusive). */
export function rollupPlayerCareerUpToYear(
  playerId: string,
  maxYear: number,
  enhancedStats: Map<string, EnhancedAppearanceStats>,
  tournamentYears: Map<string, number>,
  tournamentCtx: TournamentContext,
  finalists: Map<string, Set<string>>,
  knockoutDepth: Map<string, "semi" | "final">,
): PlayerCareerRollup {
  const rollup = emptyCareerRollup();
  const cupsSeen = new Set<string>();

  for (const [key, stats] of enhancedStats) {
    const parts = key.split("|");
    const tid = parts[0];
    const teamId = parts[1];
    const pid = parts[2];
    if (pid !== playerId || !tid || !teamId) continue;

    const year = tournamentYears.get(tid);
    if (year === undefined || year > maxYear) continue;

    cupsSeen.add(tid);
    rollup.starts += stats.starts;
    rollup.subs += stats.subs;
    rollup.goals += stats.goals;
    rollup.knockoutGoals += stats.knockoutGoals;
    rollup.finalGoals += stats.finalGoals;

    const teamName = findTeamNameForSquad(tid, teamId);
    const winner = tournamentCtx.winnerById.get(tid);
    if (winner && teamName && winner === teamName) rollup.everWonCup = true;
    if (finalists.get(tid)?.has(teamId)) rollup.everReachedFinal = true;

    const depth = knockoutDepth.get(`${tid}|${teamId}`);
    if (depth === "semi" || depth === "final") {
      rollup.everReachedSemiOrBetter = true;
    }
  }

  rollup.worldCupsPlayed = cupsSeen.size;
  return rollup;
}

const teamNameByTournamentTeam = new Map<string, string>();

function rememberTeamName(tid: string, teamId: string, teamName: string): void {
  teamNameByTournamentTeam.set(`${tid}|${teamId}`, teamName);
}

function findTeamNameForSquad(tid: string, teamId: string): string | undefined {
  return teamNameByTournamentTeam.get(`${tid}|${teamId}`);
}

function clearTeamNameIndex(): void {
  teamNameByTournamentTeam.clear();
}

function rollupToCareerInput(rollup: PlayerCareerRollup): CareerOverallInput {
  return {
    starts: rollup.starts,
    subs: rollup.subs,
    goals: rollup.goals,
    knockoutGoals: rollup.knockoutGoals,
    finalGoals: rollup.finalGoals,
    teamWonCup: rollup.everWonCup,
    teamReachedFinal: rollup.everReachedFinal,
    worldCupsPlayed: rollup.worldCupsPlayed,
  };
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

  const [squads, appearances, goals, tournaments] = await Promise.all([
    readCsvFile(paths.squads),
    readCsvFile(paths.playerAppearances),
    readCsvFile(paths.goals),
    readCsvFile(paths.tournaments),
  ]);

  const squadRows = filterSquadRows(squads, opts);

  const inRange = (r: CsvRow) => {
    const name = r.tournament_name ?? "";
    if (opts.mensOnly && !isMensTournament(name)) return false;
    const year = parseYear(name);
    return year !== null && year >= opts.fromYear && year <= opts.toYear;
  };

  const appearanceRows = appearances.filter(inRange);
  const goalRows = goals.filter(inRange);

  const enhancedStats = buildEnhancedStats(appearanceRows, goalRows);
  const appearancePositionCounts = indexAppearancePositionCounts(appearanceRows);
  const finalists = indexFinalists(appearanceRows);
  const tournamentYears = indexTournamentYears([
    ...squadRows,
    ...appearanceRows,
  ]);
  const knockoutDepth = indexTeamKnockoutDepth(appearanceRows);
  const tournamentCtx = loadTournamentContext(
    tournaments.filter((r) => {
      const name = r.tournament_name ?? "";
      if (opts.mensOnly && !name.includes("Men's")) return false;
      const year = Number(r.year);
      return (
        Number.isFinite(year) &&
        year >= opts.fromYear &&
        year <= opts.toYear
      );
    }),
  );

  /** Group squad rows by (team, cup). */
  const groups = new Map<string, CsvRow[]>();
  clearTeamNameIndex();
  for (const row of squadRows) {
    const year = parseYear(row.tournament_name ?? "");
    if (year === null) continue;
    const team = row.team_name ?? "Unknown";
    rememberTeamName(row.tournament_id!, row.team_id!, team);
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
    const overalls = new Map<string, number>();

    const winner = tournamentCtx.winnerById.get(tournamentId);
    const editionWonCup = winner !== undefined && winner === team;
    const editionReachedFinal =
      finalists.get(tournamentId)?.has(teamId) ?? editionWonCup;

    for (const row of members) {
      const key = squadPlayerKey(tournamentId, teamId, row.player_id!);
      const estats = enhancedStats.get(key) ?? emptyEnhancedStats();
      merits.set(key, appearanceMerit(estats));

      const careerRollup = rollupPlayerCareerUpToYear(
        row.player_id!,
        cup,
        enhancedStats,
        tournamentYears,
        tournamentCtx,
        finalists,
        knockoutDepth,
      );

      const editionInput: CareerOverallInput = {
        starts: estats.starts,
        subs: estats.subs,
        goals: estats.goals,
        knockoutGoals: estats.knockoutGoals,
        finalGoals: estats.finalGoals,
        teamWonCup: editionWonCup,
        teamReachedFinal: editionReachedFinal,
        worldCupsPlayed: careerRollup.worldCupsPlayed,
      };

      const careerInput = rollupToCareerInput(careerRollup);

      const shirtRaw = Number(row.shirt_number);
      const shirtNumber =
        Number.isFinite(shirtRaw) && shirtRaw > 0 ? shirtRaw : undefined;

      const pedigree: CareerPedigreeInput = {
        worldCupsPlayed: careerRollup.worldCupsPlayed,
        careerStarts: careerRollup.starts,
        careerGoals: careerRollup.goals,
        careerKnockoutGoals: careerRollup.knockoutGoals,
        everWonCup: careerRollup.everWonCup,
        everReachedFinal: careerRollup.everReachedFinal,
        everReachedSemiOrBetter: careerRollup.everReachedSemiOrBetter,
        editionStarts: estats.starts,
        coarsePosition: (row.position_code ?? "MF").trim().toUpperCase(),
        ...(shirtNumber !== undefined ? { shirtNumber } : {}),
      };

      overalls.set(
        key,
        finalizePlayerOverall(
          { edition: editionInput, career: careerInput, pedigree },
          key,
        ),
      );
    }

    const forces = meritsToForces(merits, (k) => k);

    const players = members.map((row) => {
      const key = squadPlayerKey(tournamentId, teamId, row.player_id!);
      const shirtRaw = Number(row.shirt_number);
      const shirtNumber =
        Number.isFinite(shirtRaw) && shirtRaw > 0 ? shirtRaw : undefined;

      // Fjelstul only encodes coarse roles (GK/DF/MF/FW). FW expands to the
      // striker line (ST/CF), not wing slots — see positionCodesFromFjelstul.
      const primaryCode = (row.position_code ?? "MF").trim().toUpperCase();
      let naturalPosition = mapPositionCode(primaryCode);
      if (primaryCode === "DF") {
        naturalPosition = resolveDefenderNaturalPosition(
          appearancePositionCounts.get(key),
        );
      }
      const positions = uniqueExpanded([
        ...positionCodesFromFjelstul(primaryCode),
      ]);

      return {
        id: catalogPlayerId(scenarioId, row.player_id!),
        name: playerDisplayName(row.given_name ?? "", row.family_name ?? ""),
        naturalPosition,
        ...(positions.length > 0 ? { positions } : {}),
        positionSource: "inferred" as const,
        force: forces.get(key) ?? 160,
        overall: overalls.get(key) ?? 65,
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

/** Unique scenario slugs (e.g. `brazil-1970`) from a Fjelstul `squads.csv`. */
export async function listFjelstulScenarioSlugs(
  squadsCsvPath: string,
  options?: Pick<FjelstulImportOptions, "mensOnly" | "fromYear" | "toYear">,
): Promise<string[]> {
  const mensOnly = options?.mensOnly ?? true;
  const fromYear = options?.fromYear ?? 1930;
  const toYear = options?.toYear ?? 2022;

  const rows = await readCsvFile(squadsCsvPath);
  const slugs = new Set<string>();

  for (const row of rows) {
    const tournamentName = row.tournament_name ?? "";
    const year = parseYear(tournamentName);
    if (year === null || year < fromYear || year > toYear) continue;
    if (mensOnly && !isMensTournament(tournamentName)) continue;

    const team = row.team_name?.trim();
    if (!team) continue;
    slugs.add(scenarioIdFromTeamCup(team, year));
  }

  return [...slugs].sort();
}
