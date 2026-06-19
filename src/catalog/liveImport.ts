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
  type SquadScenario,
  normalizeCatalog,
} from "../catalog.js";
import { FORCE_OBFUSCATION_SALT } from "../constants.js";
import { hashSeed } from "../rng.js";

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
    const force = decode7a0Force(row.id, row.f);
    const card: PlayerCard = {
      id: row.id,
      name: row.name,
      team: json.sel,
      cup: json.copa,
      naturalPosition: row.pos,
      force,
      ...(row.n !== undefined ? { shirtNumber: row.n } : {}),
    };
    players.push(card);
    playerIds.push(row.id);
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
