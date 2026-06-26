import { describe, expect, it, vi } from "vitest";
import { hydrateCatalog, type SquadCatalog } from "../src/catalog.js";
import {
  applyTransfermarktPositionOverlay,
  buildTransfermarktPositionOverlay,
  isCoarseCatalogPositions,
  isEligibleForTransfermarktOverlay,
  isGenericTransfermarktLabel,
  mapTransfermarktPosition,
  parseTransfermarktPositions,
  scoreTransfermarktCandidate,
} from "../src/catalog/transfermarktImport.js";
import {
  buildTransfermarktSearchQueries,
  lookupTransfermarktAlias,
} from "../src/catalog/transfermarktAliases.js";
import type {
  TransfermarktPlayerProfileResponse,
  TransfermarktPlayerSearchResponse,
} from "../src/catalog/transfermarktClient.js";
import { isBroadDetailPositionList } from "../src/catalog/detailPositionsMigrate.js";

function inferredCatalog(): SquadCatalog {
  const players = {
    "brazil-1970__p-carlos": {
      id: "brazil-1970__p-carlos",
      name: "Roberto Carlos",
      team: "Brazil",
      cup: 1970,
      naturalPosition: "CB",
      positions: ["CB", "LB", "RB", "RCB", "LCB"],
      positionSource: "inferred" as const,
      force: 180,
      overall: 75,
      shirtNumber: 6,
    },
    "brazil-1970__p-pele": {
      id: "brazil-1970__p-pele",
      name: "Pelé",
      team: "Brazil",
      cup: 1970,
      naturalPosition: "ST",
      positions: ["ST", "CF", "CAM"],
      positionSource: "api" as const,
      force: 200,
      overall: 95,
    },
  };

  return hydrateCatalog({
    scenarios: [
      {
        id: "brazil-1970",
        team: "Brazil",
        cup: 1970,
        playerIds: Object.keys(players),
      },
    ],
    players,
  });
}

describe("transfermarkt position mapping", () => {
  it("maps fine Transfermarkt labels to internal codes", () => {
    expect(mapTransfermarktPosition("Left-Back")).toBe("LB");
    expect(mapTransfermarktPosition("Defensive Midfield")).toBe("CDM");
    expect(mapTransfermarktPosition("Attacking Midfield")).toBe("CAM");
    expect(mapTransfermarktPosition("Centre-Forward")).toBe("CF");
    expect(mapTransfermarktPosition("Left Winger")).toBe("LW");
  });

  it("rejects generic Transfermarkt labels", () => {
    expect(isGenericTransfermarktLabel("Defender")).toBe(true);
    expect(isGenericTransfermarktLabel("Midfielder")).toBe(true);
    expect(isGenericTransfermarktLabel("Forward")).toBe(true);
    expect(mapTransfermarktPosition("Defender")).toBeNull();
  });

  it("parses main + other into playable list", () => {
    const parsed = parseTransfermarktPositions("Left-Back", ["Centre-Back"]);
    expect(parsed).toEqual({
      naturalPosition: "LB",
      positions: ["LB", "CB"],
    });
  });

  it("returns null when only generic labels exist", () => {
    expect(parseTransfermarktPositions("Defender", ["Midfielder"])).toBeNull();
  });
});

describe("transfermarkt eligibility", () => {
  it("detects Zafronix coarse position blobs", () => {
    expect(isCoarseCatalogPositions(["CM", "CDM", "CAM"])).toBe(true);
    expect(isCoarseCatalogPositions(["CB", "LB", "RB"])).toBe(true);
    expect(isCoarseCatalogPositions(["CAM", "CF", "LW", "CM"])).toBe(false);
  });

  it("detects broad detail blobs from old migrations separately", () => {
    expect(
      isBroadDetailPositionList(["RCB", "LCB", "CB", "LB", "LWB", "RB", "RWB"]),
    ).toBe(true);
    expect(isCoarseCatalogPositions(["RCB", "LCB", "CB", "LB", "LWB", "RB", "RWB"])).toBe(false);
  });

  it("includes coarse API players and skips fine curated lists by default", () => {
    const catalog = inferredCatalog();
    const apiPlayer = catalog.players["brazil-1970__p-pele"]!;
    const inferred = catalog.players["brazil-1970__p-carlos"]!;
    const coarseApi = {
      ...inferred,
      positionSource: "api" as const,
      positions: ["CM", "CDM", "CAM"],
    };
    expect(isEligibleForTransfermarktOverlay(apiPlayer, "inferred")).toBe(false);
    expect(isEligibleForTransfermarktOverlay(coarseApi, "inferred")).toBe(true);
    expect(isEligibleForTransfermarktOverlay(inferred, "inferred")).toBe(true);
  });

  it("--all-players maps to ambiguous mode, not full-catalog force", () => {
    const catalog = inferredCatalog();
    const sideAware = {
      ...catalog.players["brazil-1970__p-carlos"]!,
      naturalPosition: "RCB",
      positions: ["RCB", "LCB", "CB"],
      positionSource: "api" as const,
    };
    expect(isEligibleForTransfermarktOverlay(sideAware, "ambiguous")).toBe(false);
    expect(isEligibleForTransfermarktOverlay(sideAware, "force")).toBe(true);
  });

  it("keeps broad detail defender blobs eligible for ambiguous cleanup", () => {
    const broadDetailApi = {
      ...inferredCatalog().players["brazil-1970__p-carlos"]!,
      naturalPosition: "LCB",
      positions: ["RCB", "LCB", "CB", "LB", "LWB", "RB", "RWB"],
      positionSource: "api" as const,
    };

    expect(isEligibleForTransfermarktOverlay(broadDetailApi, "inferred")).toBe(false);
    expect(isEligibleForTransfermarktOverlay(broadDetailApi, "ambiguous")).toBe(true);
  });
});

describe("transfermarkt candidate scoring", () => {
  it("scores exact name matches highly", () => {
    const catalog = inferredCatalog();
    const player = catalog.players["brazil-1970__p-carlos"]!;
    const scored = scoreTransfermarktCandidate(
      player,
      "Brazil",
      1970,
      {
        id: "123",
        name: "Roberto Carlos",
        position: "Left-Back",
        club: { id: "c1", name: "Brazil" },
        nationalities: ["Brazil"],
        age: 24,
      },
      1946,
      2026,
    );
    expect(scored.confidence).toBeGreaterThanOrEqual(0.72);
  });

  it("does not match short nicknames via substring", () => {
    const catalog = inferredCatalog();
    const player = { ...catalog.players["brazil-1970__p-carlos"]!, name: "Ado" };
    const scored = scoreTransfermarktCandidate(
      player,
      "Brazil",
      1970,
      {
        id: "485706",
        name: "Amadou Onana",
        position: "DM",
        club: { id: "405", name: "Aston Villa" },
        nationalities: ["Belgium"],
        age: 24,
      },
      null,
      2026,
    );
    expect(scored.confidence).toBeLessThan(0.72);
  });

  it("boosts legacy listings without search age at historical cups", () => {
    const catalog = inferredCatalog();
    const player = {
      ...catalog.players["brazil-1970__p-carlos"]!,
      name: "Everaldo",
      naturalPosition: "CB",
      positions: ["CB", "LB", "RB"],
    };
    const scored = scoreTransfermarktCandidate(
      player,
      "Brazil",
      1970,
      {
        id: "229673",
        name: "Everaldo",
        position: "LB",
        club: { id: "4023", name: "---" },
        nationalities: ["Brazil"],
      },
      null,
      2026,
    );
    expect(scored.reasons).toContain("legacyListing");
    expect(scored.confidence).toBeGreaterThan(0.72);
  });

  it("replaces coarse forward blobs with winger positions from Transfermarkt", async () => {
    const players = {
      "brazil-1970__p-jair": {
        id: "brazil-1970__p-jair",
        name: "Jairzinho",
        team: "Brazil",
        cup: 1970,
        naturalPosition: "ST",
        positions: ["ST", "CF"],
        positionSource: "api" as const,
        force: 245,
        overall: 92,
      },
    };
    const catalog = hydrateCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          playerIds: Object.keys(players),
        },
      ],
      players,
    });

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/players/145510/profile")) {
        return new Response(
          JSON.stringify({
            id: "145510",
            name: "Jairzinho",
            citizenship: ["Brazil"],
            position: { main: "Right Winger", other: ["Left Winger"] },
          }),
          { status: 200 },
        );
      }
      return new Response("not found", { status: 404 });
    });

    const report = await buildTransfermarktPositionOverlay(catalog, {
      team: "Brazil",
      fromYear: 1970,
      toYear: 1970,
      limit: 1,
      fetchImpl,
      delayMs: 0,
    });

    expect(report.patched).toBe(1);
    expect(report.entries[0]?.naturalPosition).toBe("RW");
    expect(report.entries[0]?.positions).toEqual(["RW", "LW"]);
  });
});

describe("transfermarkt aliases", () => {
  it("resolves Brazil 1970 nickname search queries", () => {
    expect(lookupTransfermarktAlias("Brazil", 1970, "Pelé")?.transfermarktId).toBe(
      "17121",
    );
    expect(buildTransfermarktSearchQueries("Pelé", "Brazil", 1970)[0]).toBe("Pele");
    expect(lookupTransfermarktAlias("Brazil", 1970, "Carlos Alberto")?.transfermarktId).toBe(
      "229662",
    );
  });
});

describe("transfermarkt overlay apply", () => {
  it("patches inferred players without changing overall or force", () => {
    const catalog = inferredCatalog();
    const overlay = {
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            {
              id: "brazil-1970__p-carlos",
              name: "Roberto Carlos",
              naturalPosition: "LB",
              positions: ["LB", "CB"],
              positionSource: "api" as const,
              force: 999,
              overall: 99,
            },
          ],
        },
      ],
    };

    const result = applyTransfermarktPositionOverlay(catalog, overlay);
    const patched = result.catalog.players["brazil-1970__p-carlos"]!;

    expect(result.patched).toBe(1);
    expect(patched.naturalPosition).toBe("LB");
    expect(patched.positions).toEqual(["LB", "CB"]);
    expect(patched.positionSource).toBe("api");
    expect(patched.overall).toBe(75);
    expect(patched.force).toBe(180);
  });

  it("does not overwrite fine curated API players", () => {
    const catalog = inferredCatalog();
    const overlay = {
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            {
              id: "brazil-1970__p-pele",
              name: "Pelé",
              naturalPosition: "CAM",
              positions: ["CAM"],
              positionSource: "api" as const,
              force: 999,
              overall: 50,
            },
          ],
        },
      ],
    };

    const result = applyTransfermarktPositionOverlay(catalog, overlay);
    expect(result.skipped).toBe(1);
    expect(result.catalog.players["brazil-1970__p-pele"]!.naturalPosition).toBe(
      "ST",
    );
  });
});

describe("buildTransfermarktPositionOverlay", () => {
  it("builds overlay from mocked search/profile responses", async () => {
    const catalog = inferredCatalog();
    const searchResponse: TransfermarktPlayerSearchResponse = {
      query: "Roberto Carlos",
      pageNumber: 1,
      lastPageNumber: 1,
      results: [
        {
          id: "tm-123",
          name: "Roberto Carlos",
          position: "Left-Back",
          club: { id: "c1", name: "Brazil" },
          nationalities: ["Brazil"],
          age: 24,
        },
      ],
    };
    const profileResponse: TransfermarktPlayerProfileResponse = {
      id: "tm-123",
      name: "Roberto Carlos",
      dateOfBirth: "1946-04-10",
      citizenship: ["Brazil"],
      position: { main: "Left-Back", other: ["Left Midfield"] },
    };

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/players/search/")) {
        return new Response(JSON.stringify(searchResponse), { status: 200 });
      }
      if (url.includes("/profile")) {
        return new Response(JSON.stringify(profileResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const report = await buildTransfermarktPositionOverlay(catalog, {
      team: "Brazil",
      fromYear: 1970,
      toYear: 1970,
      limit: 1,
      minConfidence: 0.7,
      fetchImpl,
      delayMs: 0,
      referenceYear: 2026,
    });

    expect(report.patched).toBe(1);
    expect(report.entries[0]?.status).toBe("patched");
    expect(report.overlay.scenarios[0]?.players[0]?.naturalPosition).toBe("LB");
    expect(fetchImpl).toHaveBeenCalled();
  });

  it("marks ambiguous search results", async () => {
    const catalog = inferredCatalog();
    const searchResponse: TransfermarktPlayerSearchResponse = {
      query: "Roberto Carlos",
      pageNumber: 1,
      lastPageNumber: 1,
      results: [
        {
          id: "tm-1",
          name: "Roberto Carlos",
          position: "Left-Back",
          club: { id: "c1", name: "Brazil" },
          nationalities: ["Brazil"],
          age: 24,
        },
        {
          id: "tm-2",
          name: "Roberto Carlos",
          position: "Left-Back",
          club: { id: "c2", name: "Spain" },
          nationalities: ["Brazil"],
          age: 24,
        },
      ],
    };

    const fetchImpl = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.includes("/players/search/")) {
        return new Response(JSON.stringify(searchResponse), { status: 200 });
      }
      return new Response("not found", { status: 404 });
    });

    const report = await buildTransfermarktPositionOverlay(catalog, {
      team: "Brazil",
      fromYear: 1970,
      toYear: 1970,
      limit: 1,
      minConfidence: 0.5,
      fetchImpl,
      delayMs: 0,
    });

    expect(report.ambiguous).toBe(1);
    expect(report.entries[0]?.status).toBe("ambiguous");
  });
});
