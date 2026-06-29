/**
 * Captain Tsubasa — a hidden "dream team" easter egg.
 *
 * The best players from the *Captain Tsubasa* manga, fielded as a secret
 * national side. It is NOT part of the normal scenario pool: it can only surface
 * during the draft via a tiny per-roll jackpot gate (`CAPTAIN_TSUBASA_ODDS`),
 * so most players will never see it — but, like the original 7a0 surprises, it
 * *can* drop. All randomness still derives from the server-owned seed, so a roll
 * that hits it is reproducible and shareable.
 */

import {
  normalizeCatalog,
  type PlayerCard,
  type RawCatalogExport,
  type SquadCatalog,
  type SquadScenario,
  scenarioIdFromTeamCup,
} from "./catalog.js";

/** Display team name for the easter-egg side. */
export const CAPTAIN_TSUBASA_TEAM = "Captain Tsubasa";
/** "Cup" year — the manga's 1981 Weekly Shōnen Jump debut. */
export const CAPTAIN_TSUBASA_CUP = 1981;
/** Stable scenario id ("captain-tsubasa-1981"). */
export const CAPTAIN_TSUBASA_SCENARIO_ID = scenarioIdFromTeamCup(
  CAPTAIN_TSUBASA_TEAM,
  CAPTAIN_TSUBASA_CUP,
);

/**
 * Per-roll probability that a single draft draw lands on Captain Tsubasa.
 * 1 in 500 — rare easter egg; with ~11 turns plus rerolls most drafts still
 * miss it, but regular players will see it now and then.
 */
export const CAPTAIN_TSUBASA_ODDS = 1 / 500;

/** The 11 manga greats — Tsubasa's all-star XI (positions per the source roster). */
const CAPTAIN_TSUBASA_RAW: RawCatalogExport = {
  scenarios: [
    {
      id: CAPTAIN_TSUBASA_SCENARIO_ID,
      team: CAPTAIN_TSUBASA_TEAM,
      cup: CAPTAIN_TSUBASA_CUP,
      players: [
        {
          id: "ct-wakabayashi",
          name: "Genzo Wakabayashi",
          naturalPosition: "GK",
          positions: ["GK"],
          positionSource: "api",
          overall: 95,
          force: 245,
          shirtNumber: 1,
        },
        {
          id: "ct-kaltz",
          name: "Hermann Kaltz",
          naturalPosition: "RB",
          positions: ["RB", "LB", "CDM"],
          positionSource: "api",
          overall: 90,
          force: 230,
          shirtNumber: 2,
        },
        {
          id: "ct-gentile",
          name: "Salvatore Gentile",
          naturalPosition: "CB",
          positions: ["CB", "SW"],
          positionSource: "api",
          overall: 90,
          force: 230,
          shirtNumber: 5,
        },
        {
          id: "ct-misugi",
          name: "Jun Misugi",
          naturalPosition: "CB",
          positions: ["CB", "CDM"],
          positionSource: "api",
          overall: 89,
          force: 226,
          shirtNumber: 4,
        },
        {
          id: "ct-tsubasa",
          name: "Tsubasa Ozora",
          naturalPosition: "CAM",
          positions: ["CAM", "CM"],
          positionSource: "api",
          overall: 99,
          force: 255,
          shirtNumber: 10,
        },
        {
          id: "ct-misaki",
          name: "Taro Misaki",
          naturalPosition: "CM",
          positions: ["CM", "CAM", "LM"],
          positionSource: "api",
          overall: 94,
          force: 240,
          shirtNumber: 11,
        },
        {
          id: "ct-rivaul",
          name: "Rivaul",
          naturalPosition: "CAM",
          positions: ["CAM", "CF"],
          positionSource: "api",
          overall: 93,
          force: 238,
          shirtNumber: 8,
        },
        {
          id: "ct-natureza",
          name: "Natureza",
          naturalPosition: "LW",
          positions: ["LW", "RW", "ST"],
          positionSource: "api",
          overall: 95,
          force: 245,
          shirtNumber: 7,
        },
        {
          id: "ct-schneider",
          name: "Karl Heinz Schneider",
          naturalPosition: "ST",
          positions: ["ST"],
          positionSource: "api",
          overall: 96,
          force: 248,
          shirtNumber: 9,
        },
        {
          id: "ct-santana",
          name: "Carlos Santana",
          naturalPosition: "CF",
          positions: ["CF", "CF_FALSE9", "CAM"],
          positionSource: "api",
          overall: 95,
          force: 245,
          shirtNumber: 18,
        },
        {
          id: "ct-hyuga",
          name: "Kojiro Hyuga",
          naturalPosition: "ST",
          positions: ["ST", "CF"],
          positionSource: "api",
          overall: 96,
          force: 248,
          shirtNumber: 13,
        },
      ],
    },
  ],
};

/**
 * Local headshot path for a manga player. Drop a matching image into the web
 * app at `apps/web/public/tsubasa/<id>.webp` and it shows as the player's photo;
 * when the file is absent the avatar falls back to the holo number-card.
 * No art ships with the repo — anime character art is copyrighted, so sourcing
 * the images is left to the deployer.
 */
function tsubasaPhotoPath(id: string): string {
  return `/tsubasa/${id}.webp`;
}

const CAPTAIN_TSUBASA_RAW_WITH_PHOTOS: RawCatalogExport = {
  scenarios: CAPTAIN_TSUBASA_RAW.scenarios.map((scenario) => ({
    ...scenario,
    players: scenario.players.map((player) => ({
      ...player,
      photoUrl: tsubasaPhotoPath(player.id),
      photoSource: "curated" as const,
    })),
  })),
};

const CAPTAIN_TSUBASA_NORMALIZED: SquadCatalog = normalizeCatalog(
  CAPTAIN_TSUBASA_RAW_WITH_PHOTOS,
);

/** The easter-egg scenario, normalized. */
export const CAPTAIN_TSUBASA_SCENARIO: SquadScenario =
  CAPTAIN_TSUBASA_NORMALIZED.scenarios[0]!;

/** Whether a scenario id is the Captain Tsubasa easter egg. */
export function isCaptainTsubasaScenario(scenarioId: string): boolean {
  return scenarioId === CAPTAIN_TSUBASA_SCENARIO_ID;
}

/** Whether a team name belongs to the Captain Tsubasa easter-egg side. */
export function isCaptainTsubasaTeam(team: string): boolean {
  return team === CAPTAIN_TSUBASA_TEAM;
}

/**
 * Merge the hidden Captain Tsubasa squad into a catalog (idempotent). The
 * scenario is appended so it exists for lookup/draw, but draw helpers keep it
 * out of the normal uniform pool — it only appears via the jackpot gate.
 */
export function withCaptainTsubasa(catalog: SquadCatalog): SquadCatalog {
  if (catalog.scenarios.some((s) => isCaptainTsubasaScenario(s.id))) {
    return catalog;
  }
  const players: Record<string, PlayerCard> = {
    ...catalog.players,
    ...CAPTAIN_TSUBASA_NORMALIZED.players,
  };
  return {
    scenarios: [...catalog.scenarios, CAPTAIN_TSUBASA_SCENARIO],
    players,
  };
}
