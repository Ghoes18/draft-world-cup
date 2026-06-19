/**
 * Squad catalog — normalized player + scenario data for the roll/build layer.
 *
 * Each player has one autoral `force` (0–255). Team attack/defense/overall are
 * derived from the chosen XI via `lineupToTeamStrength` — not stored on scenarios.
 */

/** One real player eligible for a *(team, Cup)* scenario. */
export interface PlayerCard {
  id: string;
  name: string;
  team: string;
  cup: number;
  /** Natural position — 7a0 codes (GR, ZAG, PE…) or FIFA (GK, CB, ST…). */
  naturalPosition: string;
  shirtNumber?: number;
  /** Player strength 0–255 (decoded or autoral). */
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
  }>;
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
