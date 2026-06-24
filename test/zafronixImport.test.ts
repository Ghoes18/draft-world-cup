import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { hydrateCatalog, type SquadCatalog } from "../src/catalog.js";
import { overlayRawExportOnCatalog } from "../src/catalog/catalogOverlay.js";
import { canPlayInSlot } from "../src/playerPositions.js";
import {
  buildZafronixRawExport,
  estimatePlayerEditionStats,
  mapZafronixPosition,
  normalizeZafronixPlayerName,
  resolveRosterJersey,
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

  it("maps coarse Zafronix positions to tight API lists", () => {
    const fw = mapZafronixPosition("FW");
    expect(fw.naturalPosition).toBe("ST");
    expect(fw.positionSource).toBe("api");
    expect(fw.positions).toEqual(["ST", "CF"]);
    expect(fw.positions).not.toContain("RW");

    const mf = mapZafronixPosition("MF");
    expect(mf.naturalPosition).toBe("CM");
    expect(mf.positionSource).toBe("api");
    expect(mf.positions).toEqual(["CM", "CDM", "CAM"]);
    expect(mf.positions).not.toContain("LW");
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

  it("spreads inferred minutes when Zafronix omits jersey numbers", () => {
    const context = {
      teamMatches: 3,
      teamWonCup: false,
      teamReachedFinal: false,
      teamReachedSemiOrBetter: false,
    };
    const roster = [
      { jersey: null, name: "Enrique Avalos", position: "FW", goals: 0 },
      { jersey: null, name: "Marcial Avalos", position: "FW", goals: 0 },
      { jersey: null, name: "Melanio Baez", position: "MF", goals: 0 },
      { jersey: null, name: "Ángel Berni", position: "FW", goals: 0 },
    ];
    const overalls = roster.map((player) => {
      const jersey = resolveRosterJersey(player);
      expect(jersey).toBeGreaterThanOrEqual(1);
      expect(jersey).toBeLessThanOrEqual(22);
      return estimatePlayerEditionStats(player, context);
    });
    expect(new Set(overalls.map((s) => s.starts)).size).toBeGreaterThan(1);
    expect(new Set(overalls.map((s) => `${s.starts}-${s.subs}`)).size).toBeGreaterThan(
      1,
    );
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

  it("differentiates Paraguay 1950 when Zafronix omits jersey numbers", () => {
    const doc = JSON.parse(
      readFileSync(resolve("data/zafronix/tournaments_1950.json"), "utf8"),
    ) as ZafronixTournamentDoc;
    const tournaments = new Map<number, ZafronixTournamentDoc>([[1950, doc]]);
    const base = hydrateCatalog({
      scenarios: [
        {
          id: "paraguay-1950",
          team: "Paraguay",
          cup: 1950,
          playerIds: [
            "paraguay-1950__p-1",
            "paraguay-1950__p-2",
            "paraguay-1950__p-3",
            "paraguay-1950__p-4",
          ],
        },
      ],
      players: {
        "paraguay-1950__p-1": {
          id: "paraguay-1950__p-1",
          name: "Enrique Avalos",
          team: "Paraguay",
          cup: 1950,
          naturalPosition: "ST",
          force: 160,
          overall: 62,
        },
        "paraguay-1950__p-2": {
          id: "paraguay-1950__p-2",
          name: "Marcial Avalos",
          team: "Paraguay",
          cup: 1950,
          naturalPosition: "ST",
          force: 160,
          overall: 62,
        },
        "paraguay-1950__p-3": {
          id: "paraguay-1950__p-3",
          name: "Melanio Baez",
          team: "Paraguay",
          cup: 1950,
          naturalPosition: "CM",
          force: 160,
          overall: 62,
        },
        "paraguay-1950__p-4": {
          id: "paraguay-1950__p-4",
          name: "Ángel Berni",
          team: "Paraguay",
          cup: 1950,
          naturalPosition: "ST",
          force: 160,
          overall: 62,
        },
      },
    });

    const { raw } = buildZafronixRawExport(base, tournaments, {
      fromYear: 1950,
      toYear: 1950,
    });
    const result = overlayRawExportOnCatalog(base, [raw]);
    const overalls = [
      result.catalog.players["paraguay-1950__p-1"]!.overall,
      result.catalog.players["paraguay-1950__p-2"]!.overall,
      result.catalog.players["paraguay-1950__p-3"]!.overall,
      result.catalog.players["paraguay-1950__p-4"]!.overall,
    ];
    expect(new Set(overalls).size).toBeGreaterThan(1);
    expect(overalls.filter((ovr) => ovr === 69).length).toBeLessThan(
      overalls.length,
    );
  });

  it("restricts coarse FW Zafronix players to striker-line slots (Eto'o)", () => {
    const doc = JSON.parse(
      readFileSync(resolve("data/zafronix/tournaments_2010.json"), "utf8"),
    ) as ZafronixTournamentDoc;
    const tournaments = new Map<number, ZafronixTournamentDoc>([[2010, doc]]);
    const base = hydrateCatalog({
      scenarios: [
        {
          id: "cameroon-2010",
          team: "Cameroon",
          cup: 2010,
          playerIds: ["cameroon-2010__eto"],
        },
      ],
      players: {
        "cameroon-2010__eto": {
          id: "cameroon-2010__eto",
          name: "Samuel Eto'o",
          team: "Cameroon",
          cup: 2010,
          naturalPosition: "ST",
          positions: ["RW", "LW", "ST", "CF"],
          positionSource: "inferred",
          force: 160,
          overall: 62,
        },
      },
    });

    const { raw } = buildZafronixRawExport(base, tournaments, {
      fromYear: 2010,
      toYear: 2010,
    });
    const result = overlayRawExportOnCatalog(base, [raw]);
    const eto = result.catalog.players["cameroon-2010__eto"]!;

    expect(eto.positionSource).toBe("api");
    expect(eto.positions).toEqual(["ST", "CF"]);
    expect(canPlayInSlot(eto, "ST")).toBe(true);
    expect(canPlayInSlot(eto, "CF")).toBe(true);
    expect(canPlayInSlot(eto, "RW")).toBe(false);
    expect(canPlayInSlot(eto, "LW")).toBe(false);
    expect(canPlayInSlot(eto, "CAM")).toBe(false);
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
