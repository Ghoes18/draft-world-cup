import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hydrateCatalog, type SquadCatalog } from "../src/catalog.js";
import { overlayRawExportOnCatalog } from "../src/catalog/catalogOverlay.js";
import {
  buildZafronixRawExport,
  estimatePlayerEditionStats,
  mapZafronixPosition,
  normalizeZafronixPlayerName,
  teamMatchesPlayed,
  teamNamesMatch,
} from "../src/catalog/zafronixImport.js";
import type { ZafronixTournamentDoc } from "../src/catalog/zafronixClient.js";

function loadFixture(name: string): ZafronixTournamentDoc {
  const path = resolve("test/fixtures/zafronix", name);
  return JSON.parse(readFileSync(path, "utf8")) as ZafronixTournamentDoc;
}

function miniArgentina1966Catalog(): SquadCatalog {
  const players = {
    "argentina-1966__p-00867": {
      id: "argentina-1966__p-00867",
      name: "Antonio Rattín",
      team: "Argentina",
      cup: 1966,
      naturalPosition: "CM",
      force: 160,
      overall: 62,
      shirtNumber: 10,
    },
    "argentina-1966__p-47496": {
      id: "argentina-1966__p-47496",
      name: "Luis Artime",
      team: "Argentina",
      cup: 1966,
      naturalPosition: "ST",
      force: 160,
      overall: 79,
      shirtNumber: 19,
    },
    "argentina-1966__p-20306": {
      id: "argentina-1966__p-20306",
      name: "Ermindo Onega",
      team: "Argentina",
      cup: 1966,
      naturalPosition: "ST",
      force: 160,
      overall: 70,
      shirtNumber: 20,
    },
    "argentina-1966__p-95542": {
      id: "argentina-1966__p-95542",
      name: "Aníbal Tarabini",
      team: "Argentina",
      cup: 1966,
      naturalPosition: "ST",
      force: 160,
      overall: 62,
      shirtNumber: 22,
    },
  };

  return hydrateCatalog({
    scenarios: [
      {
        id: "argentina-1966",
        team: "Argentina",
        cup: 1966,
        playerIds: Object.keys(players),
      },
    ],
    players,
  });
}

describe("zafronixImport helpers", () => {
  it("matches team aliases", () => {
    expect(teamNamesMatch("Ivory Coast", "Côte d'Ivoire")).toBe(true);
    expect(teamNamesMatch("Argentina", "Argentina")).toBe(true);
  });

  it("normalizes player names", () => {
    expect(normalizeZafronixPlayerName("Antonio Rattín")).toBe("antoniorattin");
  });

  it("maps coarse Zafronix positions", () => {
    const mf = mapZafronixPosition("MF");
    expect(mf.naturalPosition).toBe("CM");
    expect(mf.positionSource).toBe("inferred");
    expect(mf.positions.length).toBeGreaterThan(3);
  });

  it("estimates QF exit as four team matches", () => {
    expect(teamMatchesPlayed(6, 1966)).toBe(4);
  });

  it("estimates starter minutes for Rattín", () => {
    const stats = estimatePlayerEditionStats(
      { jersey: 10, name: "Antonio Rattín", position: "MF", starter: true },
      {
        teamMatches: 4,
        teamWonCup: false,
        teamReachedFinal: false,
        teamReachedSemiOrBetter: false,
      },
    );
    expect(stats.starts).toBe(4);
    expect(stats.goals).toBe(0);
  });

  it("infers group-stage starts for iconic shirt when Zafronix omits starter", () => {
    const stats = estimatePlayerEditionStats(
      { jersey: 7, name: "Luís Figo", position: "MF", goals: 0 },
      {
        teamMatches: 3,
        teamWonCup: false,
        teamReachedFinal: false,
        teamReachedSemiOrBetter: false,
      },
    );
    expect(stats.starts).toBe(3);
  });
});

describe("buildZafronixRawExport", () => {
  it("raises Argentina 1966 starters above the 62 floor", () => {
    const doc = loadFixture("tournament-1966-argentina.json");
    const tournaments = new Map<number, ZafronixTournamentDoc>([[1966, doc]]);
    const base = miniArgentina1966Catalog();

    const { raw } = buildZafronixRawExport(base, tournaments, {
      fromYear: 1966,
      toYear: 1966,
    });

    const result = overlayRawExportOnCatalog(base, [raw]);
    const rattin = result.catalog.players["argentina-1966__p-00867"]!;
    const artime = result.catalog.players["argentina-1966__p-47496"]!;
    const bench = result.catalog.players["argentina-1966__p-95542"]!;

    expect(result.patched).toBeGreaterThanOrEqual(4);
    expect(rattin.overall).toBeGreaterThan(62);
    expect(artime.overall).toBeGreaterThanOrEqual(79);
    expect(bench.overall).toBeGreaterThanOrEqual(62);
  });

  it("raises Figo-style stars when Zafronix omits starter flags (2002)", () => {
    const doc = loadFixture("tournament-2002-portugal-figo.json");
    const tournaments = new Map<number, ZafronixTournamentDoc>([[2002, doc]]);
    const base = hydrateCatalog({
      scenarios: [
        {
          id: "portugal-2002",
          team: "Portugal",
          cup: 2002,
          playerIds: ["portugal-2002__figo"],
        },
      ],
      players: {
        "portugal-2002__figo": {
          id: "portugal-2002__figo",
          name: "Luís Figo",
          team: "Portugal",
          cup: 2002,
          naturalPosition: "CM",
          force: 160,
          overall: 62,
          shirtNumber: 7,
        },
      },
    });

    const { raw } = buildZafronixRawExport(base, tournaments, {
      fromYear: 2002,
      toYear: 2002,
    });
    const result = overlayRawExportOnCatalog(base, [raw]);
    const figo = result.catalog.players["portugal-2002__figo"]!;
    expect(figo.overall).toBeGreaterThanOrEqual(78);
    expect(figo.overall).toBeLessThanOrEqual(93);
  });
});
