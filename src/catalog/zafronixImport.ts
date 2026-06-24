/**
 * Enrich Fjelstul catalog scenarios with Zafronix roster data (1930–2026).
 *
 * Fills appearance gaps before 1970 where Fjelstul has no player_appearances rows.
 * Recomputes autoral overall + force via derivePlayerOverall / meritsToForces.
 */

import {
  scenarioIdFromTeamCup,
  type RawCatalogExport,
  type SquadCatalog,
} from "../catalog.js";
import {
  appearanceMerit,
  meritsToForces,
} from "./deriveForce.js";
import {
  finalizePlayerOverall,
  type CareerOverallInput,
  type CareerPedigreeInput,
} from "./deriveOverall.js";
import { hashSeed } from "../rng.js";
import {
  getZafronixTournamentMeta,
  parseZafronixTournamentTeams,
  type ZafronixRosterPlayer,
  type ZafronixTeamEntry,
  type ZafronixTournamentDoc,
} from "./zafronixClient.js";

export interface ZafronixImportOptions {
  fromYear: number;
  toYear: number;
  /** Include earlier tournaments when rolling up player careers (default: toYear). */
  careerFromYear?: number;
}

interface TeamEditionContext {
  teamMatches: number;
  teamWonCup: boolean;
  teamReachedFinal: boolean;
  teamReachedSemiOrBetter: boolean;
}

interface IndexedPlayerAppearance {
  year: number;
  team: string;
  player: ZafronixRosterPlayer;
  context: TeamEditionContext;
}

interface PlayerEditionStats {
  starts: number;
  subs: number;
  goals: number;
  knockoutGoals: number;
  finalGoals: number;
}

interface CareerRollup {
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

/**
 * Zafronix often returns only GK/DF/MF/FW. Map to tight API lists (7a0-style:
 * e.g. FW → ST + CF / ATA + AVC), not the full Fjelstul role expansion.
 */
const ZAFRONIX_COARSE_PLAYABLE: Record<
  string,
  { naturalPosition: string; positions: readonly string[] }
> = {
  GK: { naturalPosition: "GK", positions: ["GK"] },
  DF: { naturalPosition: "CB", positions: ["CB", "LB", "RB"] },
  MF: { naturalPosition: "CM", positions: ["CM", "CDM", "CAM"] },
  FW: { naturalPosition: "ST", positions: ["ST", "CF"] },
};

/** Normalize team names for catalog ↔ Zafronix matching. */
export function normalizeTeamName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const TEAM_ALIASES: Readonly<Record<string, readonly string[]>> = {
  "ivory coast": ["cote divoire", "cote d ivoire"],
  "united states": ["usa", "u s a"],
  "south korea": ["korea republic", "korea south"],
  "north korea": ["korea dpr", "dpr korea"],
  "czech republic": ["czechia"],
  "republic of ireland": ["ireland"],
};

export function teamNamesMatch(catalogTeam: string, zafronixTeam: string): boolean {
  const a = normalizeTeamName(catalogTeam);
  const b = normalizeTeamName(zafronixTeam);
  if (a === b) return true;

  const aliasesA = TEAM_ALIASES[a] ?? [];
  if (aliasesA.some((alias) => alias === b)) return true;

  const aliasesB = TEAM_ALIASES[b] ?? [];
  if (aliasesB.some((alias) => alias === a)) return true;

  return false;
}

export function normalizeZafronixPlayerName(name: string): string {
  return name
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Zafronix often omits `jersey` on pre-1970 squads. Using a fixed fallback (99)
 * made every player share the same inferred starts/subs and overall.
 */
export function resolveRosterJersey(player: ZafronixRosterPlayer): number {
  if (
    typeof player.jersey === "number" &&
    Number.isFinite(player.jersey) &&
    player.jersey > 0
  ) {
    return Math.round(player.jersey);
  }
  const name = normalizeZafronixPlayerName(
    player.fullName ?? player.name ?? "unknown",
  );
  return (hashSeed(name) % 22) + 1;
}

/** Map Zafronix position codes to catalog natural + playable positions. */
export function mapZafronixPosition(position: string): {
  naturalPosition: string;
  positions: string[];
  positionSource: "api" | "inferred";
} {
  const code = position.trim().toUpperCase();
  const coarse = ZAFRONIX_COARSE_PLAYABLE[code];
  if (coarse) {
    return {
      naturalPosition: coarse.naturalPosition,
      positions: [...coarse.positions],
      positionSource: "api",
    };
  }

  return {
    naturalPosition: code,
    positions: [code],
    positionSource: "api",
  };
}

/** Estimate matches played from final standing (FIFA-era heuristics). */
export function teamMatchesPlayed(
  finalPosition: number | null | undefined,
  year: number,
): number {
  if (finalPosition === 1 || finalPosition === 2) {
    if (year >= 1998 && year < 2026) return 7;
    return 6;
  }
  if (finalPosition === 3 || finalPosition === 4) return 5;
  if (
    finalPosition !== null &&
    finalPosition !== undefined &&
    finalPosition >= 5 &&
    finalPosition <= 8
  ) {
    return 4;
  }
  return 3;
}

function teamEditionContext(
  teamName: string,
  meta: { champion?: string | null; runnerUp?: string | null },
  finalPosition: number | null | undefined,
  year: number,
): TeamEditionContext {
  const wonCup =
    meta.champion !== null &&
    meta.champion !== undefined &&
    teamNamesMatch(teamName, meta.champion);
  const reachedFinal =
    wonCup ||
    (meta.runnerUp !== null &&
      meta.runnerUp !== undefined &&
      teamNamesMatch(teamName, meta.runnerUp)) ||
    finalPosition === 1 ||
    finalPosition === 2;
  const reachedSemiOrBetter =
    reachedFinal || finalPosition === 3 || finalPosition === 4;

  return {
    teamMatches: teamMatchesPlayed(finalPosition, year),
    teamWonCup: wonCup,
    teamReachedFinal: reachedFinal,
    teamReachedSemiOrBetter: reachedSemiOrBetter,
  };
}

/** Estimate starts/subs/goals from Zafronix roster row + team match count. */
export function estimatePlayerEditionStats(
  player: ZafronixRosterPlayer,
  context: TeamEditionContext,
): PlayerEditionStats {
  const goals = player.goals ?? 0;
  const teamMatches = context.teamMatches;

  let starts = 0;
  let subs = 0;

  if (typeof player.minutes === "number" && player.minutes > 0) {
    starts = Math.min(teamMatches, Math.max(1, Math.round(player.minutes / 70)));
    if (typeof player.appearances === "number" && player.appearances > starts) {
      subs = Math.min(teamMatches - starts, player.appearances - starts);
    }
  } else if (typeof player.appearances === "number" && player.appearances > 0) {
    const apps = Math.min(teamMatches, player.appearances);
    if (player.starter === true) {
      starts = apps;
    } else {
      subs = apps;
    }
  } else if (player.starter === true) {
    starts = teamMatches;
  } else if (goals > 0 || player.captain === true) {
    subs = Math.min(2, teamMatches);
    starts = Math.min(3, teamMatches - subs);
  } else if (starts === 0 && subs === 0) {
    // Zafronix roster rows often omit minutes/appearances/starter. Infer from
    // squad number: 1–11 ≈ regular XI, 12–16 rotation, 17+ bench.
    const jersey = resolveRosterJersey(player);
    if (jersey <= 11) {
      starts = Math.min(3, teamMatches);
    } else if (jersey <= 16) {
      starts = Math.min(2, teamMatches);
      subs = Math.min(1, Math.max(0, teamMatches - starts));
    } else {
      subs = Math.min(2, teamMatches);
      starts = Math.min(1, Math.max(0, teamMatches - starts));
    }
  }

  const knockoutGoals =
    teamMatches > 3 && goals > 0 ? Math.min(goals, teamMatches - 3) : 0;
  const finalGoals =
    context.teamReachedFinal && goals > 0
      ? Math.min(goals, Math.max(0, goals - knockoutGoals))
      : 0;

  return { starts, subs, goals, knockoutGoals, finalGoals };
}

function emptyCareerRollup(): CareerRollup {
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

function rollupCareerFromAppearances(
  appearances: readonly IndexedPlayerAppearance[],
  maxYear: number,
): CareerRollup {
  const rollup = emptyCareerRollup();
  const cupsSeen = new Set<number>();

  for (const app of appearances) {
    if (app.year > maxYear) continue;
    cupsSeen.add(app.year);
    const stats = estimatePlayerEditionStats(app.player, app.context);
    rollup.starts += stats.starts;
    rollup.subs += stats.subs;
    rollup.goals += stats.goals;
    rollup.knockoutGoals += stats.knockoutGoals;
    rollup.finalGoals += stats.finalGoals;
    if (app.context.teamWonCup) rollup.everWonCup = true;
    if (app.context.teamReachedFinal) rollup.everReachedFinal = true;
    if (app.context.teamReachedSemiOrBetter) {
      rollup.everReachedSemiOrBetter = true;
    }
  }

  rollup.worldCupsPlayed = cupsSeen.size;
  return rollup;
}

function careerRollupToInput(
  rollup: CareerRollup,
): CareerOverallInput {
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

/** Index every player appearance across loaded tournament documents. */
export function indexZafronixPlayerAppearances(
  tournaments: ReadonlyMap<number, ZafronixTournamentDoc>,
): Map<string, IndexedPlayerAppearance[]> {
  const index = new Map<string, IndexedPlayerAppearance[]>();

  for (const [year, doc] of tournaments) {
    const meta = getZafronixTournamentMeta(doc);
    for (const team of parseZafronixTournamentTeams(doc)) {
      const context = teamEditionContext(
        team.name,
        meta,
        team.finalPosition,
        year,
      );
      for (const player of team.roster) {
        const key = normalizeZafronixPlayerName(
          player.fullName ?? player.name,
        );
        const list = index.get(key) ?? [];
        list.push({ year, team: team.name, player, context });
        index.set(key, list);
      }
    }
  }

  return index;
}

function findZafronixTeam(
  catalogTeam: string,
  teams: readonly ZafronixTeamEntry[],
): ZafronixTeamEntry | undefined {
  return teams.find((t) => teamNamesMatch(catalogTeam, t.name));
}

export interface ZafronixBuildStats {
  scenariosConsidered: number;
  scenariosWithData: number;
  playersPatched: number;
  playersUnmatched: number;
}

/** Build a RawCatalogExport overlay from Zafronix tournament data. */
export function buildZafronixRawExport(
  catalog: SquadCatalog,
  tournaments: ReadonlyMap<number, ZafronixTournamentDoc>,
  options: ZafronixImportOptions,
): { raw: RawCatalogExport; stats: ZafronixBuildStats } {
  const careerIndex = indexZafronixPlayerAppearances(tournaments);
  const scenarios: RawCatalogExport["scenarios"] = [];

  let scenariosConsidered = 0;
  let scenariosWithData = 0;
  let playersPatched = 0;
  let playersUnmatched = 0;

  for (const scenario of catalog.scenarios) {
    if (scenario.cup < options.fromYear || scenario.cup > options.toYear) {
      continue;
    }
    scenariosConsidered++;

    const doc = tournaments.get(scenario.cup);
    if (!doc) continue;

    const teams = parseZafronixTournamentTeams(doc);
    const zafronixTeam = findZafronixTeam(scenario.team, teams);
    if (!zafronixTeam || zafronixTeam.roster.length === 0) continue;

    scenariosWithData++;
    const meta = getZafronixTournamentMeta(doc);
    const editionContext = teamEditionContext(
      zafronixTeam.name,
      meta,
      zafronixTeam.finalPosition,
      scenario.cup,
    );

    const overlayPlayers: RawCatalogExport["scenarios"][number]["players"] = [];
    const merits = new Map<string, number>();

    for (const rosterPlayer of zafronixTeam.roster) {
      const displayName = rosterPlayer.fullName ?? rosterPlayer.name;
      const jersey = resolveRosterJersey(rosterPlayer);
      const editionStats = estimatePlayerEditionStats(
        rosterPlayer,
        editionContext,
      );
      const careerKey = normalizeZafronixPlayerName(displayName);
      const careerRollup = rollupCareerFromAppearances(
        careerIndex.get(careerKey) ?? [],
        scenario.cup,
      );

      const editionInput: CareerOverallInput = {
        ...editionStats,
        teamWonCup: editionContext.teamWonCup,
        teamReachedFinal: editionContext.teamReachedFinal,
        worldCupsPlayed: careerRollup.worldCupsPlayed,
      };

      const careerInput = careerRollupToInput(careerRollup);
      const pos = mapZafronixPosition(rosterPlayer.position);
      const coarsePosition = rosterPlayer.position.trim().toUpperCase();

      const pedigree: CareerPedigreeInput = {
        worldCupsPlayed: careerRollup.worldCupsPlayed,
        careerStarts: careerRollup.starts,
        careerGoals: careerRollup.goals,
        careerKnockoutGoals: careerRollup.knockoutGoals,
        everWonCup: careerRollup.everWonCup,
        everReachedFinal: careerRollup.everReachedFinal,
        everReachedSemiOrBetter: careerRollup.everReachedSemiOrBetter,
        editionStarts: editionStats.starts,
        coarsePosition,
        shirtNumber: jersey,
      };

      const spreadKey = `${scenario.id}__zfx-${jersey}-${careerKey}`;
      const overall = finalizePlayerOverall(
        {
          edition: editionInput,
          career: careerInput,
          pedigree,
        },
        spreadKey,
      );

      const meritKey = careerKey;
      merits.set(meritKey, appearanceMerit(editionStats));

      overlayPlayers.push({
        id: `${scenario.id}__zfx-${jersey}`,
        name: displayName,
        naturalPosition: pos.naturalPosition,
        positions: pos.positions,
        positionSource: pos.positionSource,
        overall,
        force: 160,
        shirtNumber: jersey,
      });
      playersPatched++;
    }

    const forces = meritsToForces(merits, (k) => `${scenario.id}:${k}`);
    for (const player of overlayPlayers) {
      const meritKey = normalizeZafronixPlayerName(player.name);
      player.force = forces.get(meritKey) ?? player.force;
    }

    scenarios.push({
      id: scenario.id,
      team: scenario.team,
      cup: scenario.cup,
      players: overlayPlayers,
    });
  }

  return {
    raw: {
      scenarios: scenarios.sort(
        (a, b) => a.cup - b.cup || a.team.localeCompare(b.team),
      ),
    },
    stats: {
      scenariosConsidered,
      scenariosWithData,
      playersPatched,
      playersUnmatched,
    },
  };
}

export function scenarioIdForZafronix(team: string, cup: number): string {
  return scenarioIdFromTeamCup(team, cup);
}
