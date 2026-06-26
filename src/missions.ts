/**
 * Missions (M6) — declarative objectives a player completes through normal
 * play plus the weekly Boss challenge.
 *
 * Design: every mission is a serializable {@link MissionDef} carrying a
 * {@link MissionPredicate}. Evaluation is a pure function of one match's
 * {@link MatchOutcome} (single-match predicates) and/or the player's running
 * {@link PlayerStats} (career/cumulative predicates). The Convex layer owns
 * persistence: it folds each server-resolved match into `PlayerStats`
 * (`applyMatchToStats`) and then asks `evaluateMission` for each active
 * mission's progress — it never trusts a client-reported score.
 *
 * Keeping this pure and seed-free means the same logic runs server-side
 * (Convex) and client-side (display) with identical results, and is unit
 * testable without a backend.
 */

import { getPlayer, type SquadCatalog } from "./catalog.js";
import type { MatchResult } from "./engine.js";
import { isLegendPlayer, normalizeLegendName } from "./legends.js";
import { pick, rngFromSeed } from "./rng.js";
import type { BuildState } from "./roll.js";
import { dailyMissionSeed } from "./period.js";

/** What a mission asks for. Single-match kinds read {@link MatchOutcome};
 *  cumulative kinds read {@link PlayerStats}. */
export type MissionPredicate =
  // Single match
  | { kind: "win-margin"; min: number }
  | { kind: "win-to-nil"; minGoals: number }
  | { kind: "clean-sheet" }
  | { kind: "field-nation"; nation: string; count: number }
  | { kind: "beat-boss" }
  // Career / cumulative
  | { kind: "total-goals"; target: number }
  | { kind: "win-count"; target: number }
  | { kind: "clean-sheet-count"; target: number }
  | { kind: "legend-count"; target: number }
  | { kind: "field-legends"; legendIds: readonly string[] };

export type MissionType = "daily" | "persistent";
export type MissionCategory = "composition" | "result" | "career";

export interface MissionDef {
  id: string;
  type: MissionType;
  category: MissionCategory;
  title: string;
  description: string;
  predicate: MissionPredicate;
}

/** Running per-player facts that feed cumulative missions. */
export interface PlayerStats {
  totalGoals: number;
  wins: number;
  cleanSheets: number;
  /** Distinct legend ids (normalized names) ever fielded. */
  legendIds: string[];
  /** Distinct nations ever fielded. */
  nations: string[];
}

/** Everything one finished match contributes, from the home player's view. */
export interface MatchOutcome {
  scoreFor: number;
  scoreAgainst: number;
  won: boolean;
  cleanSheet: boolean;
  /** Count of fielded players per nation (`PlayerCard.team`). */
  nations: Record<string, number>;
  /** Normalized legend ids fielded this match. */
  legendIds: string[];
  /** Only the Boss challenge sets this true on a win. */
  beatBoss: boolean;
}

export interface MissionEvaluation {
  progress: number;
  target: number;
  completed: boolean;
}

export function emptyPlayerStats(): PlayerStats {
  return { totalGoals: 0, wins: 0, cleanSheets: 0, legendIds: [], nations: [] };
}

/**
 * Derive a {@link MatchOutcome} from a server-resolved match. `homeState` is
 * the *final* (post auto-fill) home Build state — i.e. `resolveDuel(...)
 * .finalStates.home` — so every slot has a player.
 */
export function buildMatchOutcome(
  catalog: SquadCatalog,
  homeState: BuildState,
  result: MatchResult,
  opts: { beatBoss?: boolean } = {},
): MatchOutcome {
  const [scoreFor, scoreAgainst] = result.score;
  const nations: Record<string, number> = {};
  const legendIds = new Set<string>();
  for (const slot of homeState.slots) {
    if (!slot.selectedPlayerId) continue;
    const card = getPlayer(catalog, slot.selectedPlayerId);
    nations[card.team] = (nations[card.team] ?? 0) + 1;
    if (isLegendPlayer(card.name)) legendIds.add(normalizeLegendName(card.name));
  }
  return {
    scoreFor,
    scoreAgainst,
    won: result.winner === "home",
    cleanSheet: scoreAgainst === 0,
    nations,
    legendIds: [...legendIds],
    beatBoss: opts.beatBoss ?? false,
  };
}

/** Fold one match into the running stats (returns a new object). */
export function applyMatchToStats(
  stats: PlayerStats,
  outcome: MatchOutcome,
): PlayerStats {
  const legendIds = new Set(stats.legendIds);
  for (const id of outcome.legendIds) legendIds.add(id);
  const nations = new Set(stats.nations);
  for (const n of Object.keys(outcome.nations)) nations.add(n);
  return {
    totalGoals: stats.totalGoals + outcome.scoreFor,
    wins: stats.wins + (outcome.won ? 1 : 0),
    cleanSheets: stats.cleanSheets + (outcome.cleanSheet ? 1 : 0),
    legendIds: [...legendIds],
    nations: [...nations],
  };
}

/**
 * Evaluate one mission. Single-match predicates read `outcome` (this match);
 * cumulative predicates read `stats` (already folded with this match via
 * {@link applyMatchToStats}). Single-match missions report `target: 1`.
 */
export function evaluateMission(
  def: MissionDef,
  outcome: MatchOutcome,
  stats: PlayerStats,
): MissionEvaluation {
  const p = def.predicate;
  const single = (ok: boolean): MissionEvaluation => ({
    progress: ok ? 1 : 0,
    target: 1,
    completed: ok,
  });
  const cumulative = (progress: number, target: number): MissionEvaluation => ({
    progress: Math.min(progress, target),
    target,
    completed: progress >= target,
  });

  switch (p.kind) {
    case "win-margin":
      return single(outcome.won && outcome.scoreFor - outcome.scoreAgainst >= p.min);
    case "win-to-nil":
      return single(outcome.won && outcome.scoreAgainst === 0 && outcome.scoreFor >= p.minGoals);
    case "clean-sheet":
      return single(outcome.cleanSheet);
    case "field-nation":
      return single((outcome.nations[p.nation] ?? 0) >= p.count);
    case "beat-boss":
      return single(outcome.beatBoss);
    case "total-goals":
      return cumulative(stats.totalGoals, p.target);
    case "win-count":
      return cumulative(stats.wins, p.target);
    case "clean-sheet-count":
      return cumulative(stats.cleanSheets, p.target);
    case "legend-count":
      return cumulative(stats.legendIds.length, p.target);
    case "field-legends": {
      const want = p.legendIds.map(normalizeLegendName);
      const have = new Set(stats.legendIds);
      const progress = want.filter((id) => have.has(id)).length;
      return cumulative(progress, want.length);
    }
  }
}

/** Starter mission catalog. Daily ones rotate; persistent ones are always on. */
export const MISSIONS: readonly MissionDef[] = [
  // ----- Daily pool (a deterministic subset is active each UTC day) -----
  {
    id: "d-win-margin-3",
    type: "daily",
    category: "result",
    title: "Statement win",
    description: "Win a match by 3 goals or more.",
    predicate: { kind: "win-margin", min: 3 },
  },
  {
    id: "d-clean-sheet",
    type: "daily",
    category: "result",
    title: "Lock at the back",
    description: "Finish a match without conceding.",
    predicate: { kind: "clean-sheet" },
  },
  {
    id: "d-rout-5",
    type: "daily",
    category: "result",
    title: "Rout",
    description: "Win a match 5–0 or better.",
    predicate: { kind: "win-to-nil", minGoals: 5 },
  },
  {
    id: "d-comp-brazil",
    type: "daily",
    category: "composition",
    title: "Samba XI",
    description: "Field 3+ Brazil players in one match.",
    predicate: { kind: "field-nation", nation: "Brazil", count: 3 },
  },
  {
    id: "d-comp-italy",
    type: "daily",
    category: "composition",
    title: "Catenaccio",
    description: "Field 3+ Italy players in one match.",
    predicate: { kind: "field-nation", nation: "Italy", count: 3 },
  },
  {
    id: "d-comp-germany",
    type: "daily",
    category: "composition",
    title: "Die Mannschaft",
    description: "Field 3+ Germany players in one match.",
    predicate: { kind: "field-nation", nation: "Germany", count: 3 },
  },
  {
    id: "d-comp-argentina",
    type: "daily",
    category: "composition",
    title: "Albiceleste",
    description: "Field 3+ Argentina players in one match.",
    predicate: { kind: "field-nation", nation: "Argentina", count: 3 },
  },
  // ----- Persistent (always active; periodKey "all") -----
  {
    id: "p-seven-nil",
    type: "persistent",
    category: "result",
    title: "Sete a Zero",
    description: "Win a match 7–0.",
    predicate: { kind: "win-to-nil", minGoals: 7 },
  },
  {
    id: "p-beat-boss",
    type: "persistent",
    category: "result",
    title: "Giant killer",
    description: "Beat the weekly Boss.",
    predicate: { kind: "beat-boss" },
  },
  {
    id: "p-goal-machine",
    type: "persistent",
    category: "career",
    title: "Goal machine",
    description: "Score 50 goals across your matches.",
    predicate: { kind: "total-goals", target: 50 },
  },
  {
    id: "p-serial-winner",
    type: "persistent",
    category: "career",
    title: "Serial winner",
    description: "Win 10 matches.",
    predicate: { kind: "win-count", target: 10 },
  },
  {
    id: "p-two-goats",
    type: "persistent",
    category: "career",
    title: "2 GOATs",
    description: "Field both Cristiano Ronaldo and Messi (across matches).",
    predicate: { kind: "field-legends", legendIds: ["Cristiano Ronaldo", "Messi"] },
  },
  {
    id: "p-hall-of-fame",
    type: "persistent",
    category: "career",
    title: "Hall of Fame",
    description: "Field 5 different legends.",
    predicate: { kind: "legend-count", target: 5 },
  },
];

/** All persistent missions (always active). */
export const PERSISTENT_MISSIONS: readonly MissionDef[] = MISSIONS.filter(
  (m) => m.type === "persistent",
);

const DAILY_POOL: readonly MissionDef[] = MISSIONS.filter((m) => m.type === "daily");

/**
 * The day's rotating missions — a deterministic subset of the daily pool keyed
 * to the UTC date, so every player sees the same set. Draws without
 * replacement from a seeded shuffle.
 */
export function dailyMissions(dateKey: string, n = 3): MissionDef[] {
  const count = Math.min(n, DAILY_POOL.length);
  const rng = rngFromSeed(dailyMissionSeed(dateKey));
  const pool = [...DAILY_POOL];
  const out: MissionDef[] = [];
  for (let i = 0; i < count; i++) {
    const chosen = pick(rng, pool);
    out.push(chosen);
    pool.splice(pool.indexOf(chosen), 1);
  }
  return out;
}

/** Daily missions for `dateKey` plus all persistent missions. */
export function activeMissions(dateKey: string, n = 3): MissionDef[] {
  return [...dailyMissions(dateKey, n), ...PERSISTENT_MISSIONS];
}

/** Look up a mission definition by id (server validation + display). */
export function missionById(id: string): MissionDef | undefined {
  return MISSIONS.find((m) => m.id === id);
}

/** The fixed completion target for a mission (single-match missions report 1). */
export function missionTarget(def: MissionDef): number {
  const p = def.predicate;
  switch (p.kind) {
    case "total-goals":
    case "win-count":
    case "clean-sheet-count":
    case "legend-count":
      return p.target;
    case "field-legends":
      return p.legendIds.length;
    default:
      return 1;
  }
}
