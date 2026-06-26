/**
 * World Cup tournament resolution — 8 seats, 2 round-robin groups of 4,
 * cross-bracket semis, final. Pure and deterministic in `tournamentSeed`.
 *
 * Shared by the Convex online pool (`apps/web/convex/tournament.ts`) and the
 * offline solo client (`apps/web/app/page.tsx`).
 */

import type { ResolvedSide } from "./online.js";
import { resolveDuel } from "./online.js";
import type { MatchTimeline, Side } from "./types.js";
import type { SquadCatalog } from "./catalog.js";
import { autoFillLineup, initBuildState } from "./roll.js";
import { rngFromSeed } from "./rng.js";

export const POOL_SIZE = 8;

export const GROUP_PAIRS: readonly [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

export type TournamentStage = "group" | "semi" | "final";

/** One tournament seat before slot assignment. */
export type TournamentEntry =
  | { kind: "human"; name: string; playerId?: string; resolve: (side: Side) => ResolvedSide }
  | { kind: "cpu"; name: string; scenarioId: string; seed: string };

export interface TournamentParticipant {
  slot: number;
  groupIndex: number;
  kind: "human" | "cpu";
  name: string;
  scenarioId?: string;
  playerId?: string;
}

export interface TournamentMatch {
  stage: TournamentStage;
  groupIndex?: number;
  homeSlot: number;
  awaySlot: number;
  seed: string;
  gf: number;
  ga: number;
  winnerSlot?: number;
  timeline: MatchTimeline;
}

export interface StandingsRow {
  slot: number;
  points: number;
  gf: number;
  ga: number;
  gd: number;
  played: number;
}

export interface ResolvedTournament {
  seed: string;
  championSlot: number;
  participants: TournamentParticipant[];
  matches: TournamentMatch[];
  standings: { groupIndex: number; table: StandingsRow[] }[];
}

function shuffled<T>(items: readonly T[], tournamentSeed: string, tag: string): T[] {
  const rng = rngFromSeed(`${tournamentSeed}:${tag}`);
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

/** Resolve one entry's authoritative Build state for a specific fixture side. */
export function resolveEntrySide(
  catalog: SquadCatalog,
  entry: TournamentEntry,
  side: Side,
): ResolvedSide {
  if (entry.kind === "cpu") {
    const state = autoFillLineup(
      catalog,
      initBuildState(catalog, entry.seed, side, entry.scenarioId),
    );
    return { buildState: state, tactic: "balanced" };
  }
  return entry.resolve(side);
}

/** Pick `n` distinct real historical squads for CPU bot-fill. */
export function pickBotEntries(
  catalog: SquadCatalog,
  n: number,
  tournamentSeed: string,
): TournamentEntry[] {
  return shuffled(catalog.scenarios, tournamentSeed, "bots")
    .slice(0, n)
    .map((scenario, i) => ({
      kind: "cpu" as const,
      scenarioId: scenario.id,
      name: `${scenario.team} ${scenario.cup}`,
      seed: `${tournamentSeed}:bot:${scenario.id}:${i}`,
    }));
}

/** Standings table for one group from its (already-played) fixtures. */
export function computeStandings(
  groupIndex: number,
  matches: readonly Pick<
    TournamentMatch,
    "groupIndex" | "homeSlot" | "awaySlot" | "gf" | "ga" | "winnerSlot"
  >[],
): StandingsRow[] {
  const base = groupIndex * 4;
  const table = new Map<number, { points: number; gf: number; ga: number; played: number }>();
  for (let i = 0; i < 4; i++) table.set(base + i, { points: 0, gf: 0, ga: 0, played: 0 });
  for (const m of matches) {
    if (m.groupIndex !== groupIndex) continue;
    const home = table.get(m.homeSlot)!;
    const away = table.get(m.awaySlot)!;
    home.gf += m.gf;
    home.ga += m.ga;
    home.played += 1;
    away.gf += m.ga;
    away.ga += m.gf;
    away.played += 1;
    if (m.winnerSlot === undefined) {
      home.points += 1;
      away.points += 1;
    } else if (m.winnerSlot === m.homeSlot) {
      home.points += 3;
    } else {
      away.points += 3;
    }
  }
  return [...table.entries()]
    .map(([slot, t]) => ({ slot, ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
}

/**
 * Resolve a full 8-player World Cup from exactly 8 entries (human and/or CPU
 * bot): shuffle into 2 groups of 4, play every group fixture, seed the
 * knockout bracket from the standings, play the semis and final.
 */
export function resolveWorldCup(
  catalog: SquadCatalog,
  entries: readonly TournamentEntry[],
  tournamentSeed?: string,
): ResolvedTournament {
  if (entries.length !== POOL_SIZE) {
    throw new Error(`World Cup requires exactly ${POOL_SIZE} entries`);
  }

  const seed = tournamentSeed ?? `wc:${Date.now()}`;
  const seats = shuffled(entries, seed, "seats");

  const participants: TournamentParticipant[] = seats.map((entry, slot) => {
    const base = {
      slot,
      groupIndex: slot < 4 ? 0 : 1,
      kind: entry.kind,
      name: entry.name,
    };
    if (entry.kind === "cpu") {
      return { ...base, scenarioId: entry.scenarioId };
    }
    if (entry.playerId) {
      return { ...base, playerId: entry.playerId };
    }
    return base;
  });

  function playMatch(
    homeSlot: number,
    awaySlot: number,
    stage: TournamentStage,
    groupIndex: number | undefined,
    fixtureTag: string,
    knockout: boolean,
  ): TournamentMatch {
    const home = resolveEntrySide(catalog, seats[homeSlot]!, "home");
    const away = resolveEntrySide(catalog, seats[awaySlot]!, "away");
    const fixtureSeed = `${seed}:${fixtureTag}`;
    const { result, timeline } = resolveDuel(catalog, {
      seed: fixtureSeed,
      home,
      away,
      knockout,
    });
    const [hg, ag] = result.score;
    let winnerSlot: number | undefined;
    if (result.winner === "draw") {
      if (knockout) throw new Error("knockout fixture resolved to an unresolved draw");
    } else {
      winnerSlot = result.winner === "home" ? homeSlot : awaySlot;
    }
    return {
      stage,
      homeSlot,
      awaySlot,
      seed: fixtureSeed,
      gf: hg,
      ga: ag,
      timeline,
      ...(groupIndex !== undefined ? { groupIndex } : {}),
      ...(winnerSlot !== undefined ? { winnerSlot } : {}),
    };
  }

  const groupMatches: TournamentMatch[] = [];
  for (let g = 0; g < 2; g++) {
    const base = g * 4;
    for (const [a, b] of GROUP_PAIRS) {
      groupMatches.push(playMatch(base + a, base + b, "group", g, `g${g}:${a}-${b}`, false));
    }
  }

  const standingsA = computeStandings(0, groupMatches);
  const standingsB = computeStandings(1, groupMatches);

  const sf1 = playMatch(standingsA[0]!.slot, standingsB[1]!.slot, "semi", undefined, "sf1", true);
  const sf2 = playMatch(standingsB[0]!.slot, standingsA[1]!.slot, "semi", undefined, "sf2", true);
  const final = playMatch(sf1.winnerSlot!, sf2.winnerSlot!, "final", undefined, "final", true);

  return {
    seed,
    championSlot: final.winnerSlot!,
    participants,
    matches: [...groupMatches, sf1, sf2, final],
    standings: [
      { groupIndex: 0, table: standingsA },
      { groupIndex: 1, table: standingsB },
    ],
  };
}
