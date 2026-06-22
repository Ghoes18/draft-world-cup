/**
 * Import adapters for live 7a0 squad JSON and force de-obfuscation.
 *
 * Use only on squad files you are licensed to import. Do not fetch 7a0.com.br
 * at runtime from this module.
 */

import {
  scenarioIdFromTeamCup,
  type LiveSquadJson,
  type PlayerCard,
  type RawCatalogExport,
  type SquadCatalog,
  type SquadScenario,
  normalizeCatalog,
} from "../catalog.js";
import { FORCE_OBFUSCATION_SALT } from "../constants.js";
import { hashSeed } from "../rng.js";
import {
  parsePlayablePositions,
  parsePlayerOverall,
  parsePositionSource,
  type LiveSquadPlayerJson,
} from "./livePlayerParse.js";

/** FNV-1a low byte used as XOR key in live squad JSON. */
export function fnv1aByte(input: string): number {
  return hashSeed(input) & 0xff;
}

/** Decode obfuscated `f` from live squad JSON. */
export function decode7a0Force(playerId: string, fObfuscated: number): number {
  const key = fnv1aByte(`${playerId}${FORCE_OBFUSCATION_SALT}`);
  return (fObfuscated ^ key) & 0xff;
}

/** Obfuscate force for export (inverse of decode). */
export function encode7a0Force(playerId: string, force: number): number {
  const key = fnv1aByte(`${playerId}${FORCE_OBFUSCATION_SALT}`);
  return (force & 0xff) ^ key;
}

export interface NormalizedLiveSquad {
  scenario: SquadScenario;
  players: PlayerCard[];
}

/** Parse one live `{ sel, copa, squad }` JSON into catalog-ready records. */
export function normalizeLiveSquadJson(json: LiveSquadJson): NormalizedLiveSquad {
  const id = scenarioIdFromTeamCup(json.sel, json.copa);
  const playerIds: string[] = [];
  const players: PlayerCard[] = [];

  for (const row of json.squad) {
    const liveRow = row as LiveSquadPlayerJson;
    const force = decode7a0Force(liveRow.id, liveRow.f);
    const positions = parsePlayablePositions(liveRow);
    const naturalPosition = positions[0] ?? liveRow.pos;
    const card: PlayerCard = {
      id: liveRow.id,
      name: liveRow.name,
      team: json.sel,
      cup: json.copa,
      naturalPosition,
      positions,
      positionSource: parsePositionSource(liveRow),
      force,
      overall: parsePlayerOverall(liveRow, force),
      ...(liveRow.n !== undefined ? { shirtNumber: liveRow.n } : {}),
    };
    players.push(card);
    playerIds.push(liveRow.id);
  }

  return {
    scenario: { id, team: json.sel, cup: json.copa, playerIds },
    players,
  };
}

/** Merge multiple live squad JSON files into a `RawCatalogExport`. */
export function mergeLiveSquads(squads: LiveSquadJson[]): RawCatalogExport {
  return {
    scenarios: squads.map((json) => {
      const { scenario, players } = normalizeLiveSquadJson(json);
      return {
        id: scenario.id,
        team: scenario.team,
        cup: scenario.cup,
        players: players.map((p) => ({
          id: p.id,
          name: p.name,
          naturalPosition: p.naturalPosition,
          force: p.force,
          overall: p.overall,
          ...(p.positions !== undefined ? { positions: [...p.positions] } : {}),
          ...(p.positionSource !== undefined
            ? { positionSource: p.positionSource }
            : {}),
          ...(p.shirtNumber !== undefined
            ? { shirtNumber: p.shirtNumber }
            : {}),
        })),
      };
    }),
  };
}

/** Build a full catalog from live-format squad JSON files. */
export function catalogFromLiveSquads(squads: LiveSquadJson[]) {
  return normalizeCatalog(mergeLiveSquads(squads));
}

function normalizePlayerName(name: string): string {
  return name
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Match a live squad row to a player id in an existing scenario catalog. */
export function matchLivePlayerToCatalogId(
  catalog: SquadCatalog,
  scenarioId: string,
  live: Pick<PlayerCard, "name" | "shirtNumber">,
): string | null {
  const scenario = catalog.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  if (live.shirtNumber !== undefined) {
    for (const playerId of scenario.playerIds) {
      const card = catalog.players[playerId];
      if (card?.shirtNumber === live.shirtNumber) return playerId;
    }
  }

  const liveNorm = normalizePlayerName(live.name);
  for (const playerId of scenario.playerIds) {
    const card = catalog.players[playerId];
    if (card && normalizePlayerName(card.name) === liveNorm) return playerId;
  }

  return null;
}

/**
 * Patch API positions/overall onto an existing catalog (e.g. full Fjelstul roster).
 * Players are matched per scenario by shirt number, then normalized name.
 */
export function overlayLiveSquadsOnCatalog(
  catalog: SquadCatalog,
  squads: LiveSquadJson[],
): { catalog: SquadCatalog; patched: number; unmatched: number } {
  const players: Record<string, PlayerCard> = { ...catalog.players };
  let patched = 0;
  let unmatched = 0;

  for (const json of squads) {
    const { scenario, players: livePlayers } = normalizeLiveSquadJson(json);
    const hasScenario = catalog.scenarios.some((s) => s.id === scenario.id);
    if (!hasScenario) {
      unmatched += livePlayers.length;
      continue;
    }

    for (const live of livePlayers) {
      const playerId = matchLivePlayerToCatalogId(catalog, scenario.id, live);
      if (!playerId) {
        unmatched++;
        continue;
      }

      const existing = players[playerId];
      if (!existing) {
        unmatched++;
        continue;
      }

      players[playerId] = {
        ...existing,
        naturalPosition: live.naturalPosition,
        overall: live.overall,
        force: live.force,
        ...(live.positions !== undefined ? { positions: live.positions } : {}),
        ...(live.positionSource !== undefined
          ? { positionSource: live.positionSource }
          : {}),
        ...(live.shirtNumber !== undefined
          ? { shirtNumber: live.shirtNumber }
          : {}),
      };
      patched++;
    }
  }

  return { catalog: { scenarios: catalog.scenarios, players }, patched, unmatched };
}

/** Detect live obfuscated squad JSON vs autoral export. */
export function isLiveSquadJson(
  data: unknown,
): data is LiveSquadJson {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  return (
    typeof o.sel === "string" &&
    typeof o.copa === "number" &&
    Array.isArray(o.squad)
  );
}

/** Detect autoral raw catalog export. */
export function isRawCatalogExport(
  data: unknown,
): data is RawCatalogExport {
  if (typeof data !== "object" || data === null) return false;
  const o = data as Record<string, unknown>;
  return Array.isArray(o.scenarios);
}
