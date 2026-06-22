/**
 * Squad catalog — normalized player + scenario data for the roll/build layer.
 *
 * Player `overall` (0–100) is the FIFA-style general rating from the API when
 * available. Team attack/defense/overall are derived from the chosen XI via
 * `lineupToTeamStrength` — not stored on scenarios.
 */

import { forceToRating } from "./playerRating.js";
import type { PositionSource } from "./catalog/livePlayerParse.js";

const FJELSTUL_COARSE = new Set(["GK", "CB", "CM", "ST"]);

function inferPositionSource(
  positions: readonly string[] | undefined,
  explicit?: PositionSource,
): PositionSource | undefined {
  if (explicit) return explicit;
  if (!positions?.length) return undefined;
  const coarseOnly = positions.every((p) =>
    FJELSTUL_COARSE.has(p.trim().toUpperCase()),
  );
  return coarseOnly ? "inferred" : "api";
}

function hydratePlayerCard(player: PlayerCard): PlayerCard {
  const overall =
    typeof player.overall === "number" && Number.isFinite(player.overall)
      ? Math.round(Math.min(100, Math.max(0, player.overall)))
      : forceToRating(player.force);
  const positionSource = inferPositionSource(
    player.positions,
    player.positionSource,
  );
  return {
    ...player,
    overall,
    ...(positionSource !== undefined ? { positionSource } : {}),
  };
}

/** Backfill overall/positionSource on catalogs loaded from older JSON exports. */
export function hydrateCatalog(catalog: SquadCatalog): SquadCatalog {
  const players: Record<string, PlayerCard> = {};
  for (const [id, player] of Object.entries(catalog.players)) {
    players[id] = hydratePlayerCard(player);
  }
  return { ...catalog, players };
}

/** One real player eligible for a *(team, Cup)* scenario. */
export interface PlayerCard {
  id: string;
  name: string;
  team: string;
  cup: number;
  /** Primary natural position — drives chemistry scoring. */
  naturalPosition: string;
  /**
   * Playable positions from the API for that Cup (e.g. Maradona: AM, CF, LW).
   * When set with `positionSource: "api"`, only same-role formation slots apply.
   */
  positions?: readonly string[];
  /** How `positions` were sourced — API lists are strict; inferred allows Fjelstul expansion. */
  positionSource?: PositionSource;
  shirtNumber?: number;
  /** FIFA-style general overall (0–100), shown in UI and used for team strength. */
  overall: number;
  /** Legacy raw strength 0–255 (decoded 7a0 `f` or autoral import). */
  force: number;
}

/** A *(team, Cup)* pairing with full squad roster. */
export interface SquadScenario {
  /** Stable id, e.g. "brazil-1970". */
  id: string;
  team: string;
  cup: number;
  playerIds: readonly string[];
}

/** Normalized catalog consumed by roll/build functions. */
export interface SquadCatalog {
  scenarios: readonly SquadScenario[];
  players: Readonly<Record<string, PlayerCard>>;
}

/** Raw autoral export — force in clear text. */
export interface RawCatalogExport {
  scenarios: Array<{
    id: string;
    team: string;
    cup: number;
    players: Array<{
      id: string;
      name: string;
      naturalPosition: string;
      positions?: string[];
      positionSource?: PositionSource;
      overall?: number;
      rating?: number;
      force: number;
      shirtNumber?: number;
    }>;
  }>;
}

/** Live 7a0 squad JSON shape (`/squads/{slug}.json`). */
export interface LiveSquadJson {
  sel: string;
  copa: number;
  squad: Array<{
    id: string;
    name: string;
    pos: string;
    f: number;
    n?: number;
    overall?: number;
    rating?: number;
    positions?: string[] | string;
    playablePositions?: string[] | string;
  }>;
}

function resolveOverall(
  overall: number | undefined,
  rating: number | undefined,
  force: number,
): number {
  const direct = overall ?? rating;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.round(Math.min(100, Math.max(0, direct)));
  }
  return forceToRating(force);
}

/** Normalize a raw autoral export into a `SquadCatalog`. */
export function normalizeCatalog(raw: RawCatalogExport): SquadCatalog {
  const players: Record<string, PlayerCard> = {};
  const scenarios: SquadScenario[] = [];

  for (const s of raw.scenarios) {
    const playerIds: string[] = [];
    for (const p of s.players) {
      if (players[p.id] && players[p.id]!.team !== s.team) {
        throw new Error(`duplicate player id across teams: ${p.id}`);
      }
      const card: PlayerCard = {
        id: p.id,
        name: p.name,
        team: s.team,
        cup: s.cup,
        naturalPosition: p.naturalPosition,
        force: p.force,
        overall: resolveOverall(p.overall, p.rating, p.force),
        ...(p.positions !== undefined && p.positions.length > 0
          ? { positions: p.positions }
          : {}),
        ...(p.positionSource !== undefined
          ? { positionSource: p.positionSource }
          : p.positions !== undefined && p.positions.length > 0
            ? { positionSource: "api" as const }
            : {}),
        ...(p.shirtNumber !== undefined
          ? { shirtNumber: p.shirtNumber }
          : {}),
      };
      players[p.id] = card;
      playerIds.push(p.id);
    }
    scenarios.push({
      id: s.id,
      team: s.team,
      cup: s.cup,
      playerIds,
    });
  }

  return { scenarios, players };
}

/** Look up a scenario by id; throws if missing. */
export function getScenario(
  catalog: SquadCatalog,
  scenarioId: string,
): SquadScenario {
  const s = catalog.scenarios.find((x) => x.id === scenarioId);
  if (!s) throw new Error(`unknown scenario: ${scenarioId}`);
  return s;
}

/** Resolve a player card; throws if missing. */
export function getPlayer(
  catalog: SquadCatalog,
  playerId: string,
): PlayerCard {
  const p = catalog.players[playerId];
  if (!p) throw new Error(`unknown player: ${playerId}`);
  return p;
}

/** All players in a scenario's squad. */
export function scenarioPlayers(
  catalog: SquadCatalog,
  scenarioId: string,
): PlayerCard[] {
  const scenario = getScenario(catalog, scenarioId);
  return scenario.playerIds.map((id) => getPlayer(catalog, id));
}

/** Build a stable scenario id from team + cup. */
export function scenarioIdFromTeamCup(team: string, cup: number): string {
  const slug = team
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  return `${slug}-${cup}`;
}
