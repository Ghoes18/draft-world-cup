import { describe, expect, it } from "vitest";
import {
  buildCatalogFromFjelstul,
  buildEnhancedStats,
  filterSquadRows,
  indexAppearances,
  indexAppearancePositionCounts,
  resolveDefenderNaturalPosition,
} from "../src/catalog/fjelstulImport.js";
import { appearanceMerit, meritsToForces } from "../src/catalog/deriveForce.js";
import { parseCsvLine, readCsvFile } from "../src/catalog/csv.js";
import { resolve } from "node:path";

describe("csv", () => {
  it("parses quoted fields", () => {
    expect(parseCsvLine('a,"b,c",d')).toEqual(["a", "b,c", "d"]);
  });
});

describe("deriveForce", () => {
  it("ranks starters above bench within a squad", () => {
    const merits = new Map([
      ["a", appearanceMerit({ starts: 6, subs: 0, goals: 2 })],
      ["b", appearanceMerit({ starts: 0, subs: 0, goals: 0 })],
    ]);
    const forces = meritsToForces(merits, (k) => k);
    expect(forces.get("a")!).toBeGreaterThan(forces.get("b")!);
  });
});

describe("fjelstulImport", () => {
  const fixtureDir = resolve("test/fixtures/fjelstul");

  it("builds Brazil 1970 with full squad from fixtures", async () => {
    const paths = {
      squads: `${fixtureDir}/squads.csv`,
      playerAppearances: `${fixtureDir}/player_appearances.csv`,
      goals: `${fixtureDir}/goals.csv`,
      tournaments: `${fixtureDir}/tournaments.csv`,
    };

    const raw = await buildCatalogFromFjelstul(paths, {
      mensOnly: true,
      fromYear: 1970,
      toYear: 1970,
    });

    expect(raw.scenarios).toHaveLength(1);
    expect(raw.scenarios[0]!.team).toBe("Brazil");
    expect(raw.scenarios[0]!.cup).toBe(1970);
    expect(raw.scenarios[0]!.players.length).toBeGreaterThanOrEqual(2);

    const pele = raw.scenarios[0]!.players.find((p) => p.name.includes("Pel"));
    expect(pele).toBeDefined();
    expect(pele!.name).not.toMatch(/not applicable/i);
    expect(pele!.force).toBeGreaterThan(150);
    expect(pele!.overall).toBeGreaterThanOrEqual(58);
    expect(pele!.overall).toBeLessThanOrEqual(100);
  });

  it("filters to men's tournaments only", () => {
    const rows = [
      { tournament_name: "1970 FIFA Men's World Cup" },
      { tournament_name: "2019 FIFA Women's World Cup" },
    ];
    const filtered = filterSquadRows(rows, {
      mensOnly: true,
      fromYear: 1930,
      toYear: 2022,
    });
    expect(filtered).toHaveLength(1);
  });

  it("indexes goals into enhanced appearance stats", () => {
    const stats = buildEnhancedStats(
      [
        {
          tournament_id: "WC-1970",
          team_id: "T-01",
          player_id: "P-1",
          starter: "1",
          substitute: "0",
        },
      ],
      [
        {
          tournament_id: "WC-1970",
          team_id: "T-01",
          player_team_id: "T-01",
          player_id: "P-1",
          own_goal: "0",
          stage_name: "final",
        },
      ],
    );
    const s = stats.get("WC-1970|T-01|P-1")!;
    expect(s.goals).toBe(1);
    expect(s.finalGoals).toBe(1);
    expect(appearanceMerit(s)).toBeGreaterThan(3);
  });

  it("reads fixture CSV files", async () => {
    const rows = await readCsvFile(`${fixtureDir}/squads.csv`);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0]!.team_name).toBeDefined();
  });

  it("resolveDefenderNaturalPosition prefers fine appearance codes over coarse DF", () => {
    expect(
      resolveDefenderNaturalPosition(
        new Map([
          ["RB", 6],
          ["DF", 1],
        ]),
      ),
    ).toBe("RB");
    expect(resolveDefenderNaturalPosition(new Map([["CB", 4]]))).toBe("CB");
    expect(resolveDefenderNaturalPosition(new Map([["DF", 3]]))).toBe("CB");
    expect(resolveDefenderNaturalPosition(undefined)).toBe("CB");
  });

  it("sets defender naturalPosition from appearance codes while keeping broad playable list", async () => {
    const paths = {
      squads: `${fixtureDir}/squads.csv`,
      playerAppearances: `${fixtureDir}/player_appearances.csv`,
      goals: `${fixtureDir}/goals.csv`,
      tournaments: `${fixtureDir}/tournaments.csv`,
    };

    const raw = await buildCatalogFromFjelstul(paths, {
      mensOnly: true,
      fromYear: 1970,
      toYear: 1970,
    });

    const players = raw.scenarios[0]!.players;
    const fullBack = players.find((p) => p.name.includes("Carlos"));
    const centerBack = players.find((p) => p.name.includes("Beto"));

    expect(fullBack).toBeDefined();
    expect(fullBack!.naturalPosition).toBe("RB");
    expect(fullBack!.positions).toContain("LB");
    expect(fullBack!.positions).toContain("RCB");

    expect(centerBack).toBeDefined();
    expect(centerBack!.naturalPosition).toBe("CB");
    expect(centerBack!.positions).toContain("RB");
  });

  it("indexAppearancePositionCounts tallies per-match codes", () => {
    const rows = [
      {
        tournament_id: "WC-1970",
        team_id: "T-07",
        player_id: "P-00004",
        position_code: "RB",
      },
      {
        tournament_id: "WC-1970",
        team_id: "T-07",
        player_id: "P-00004",
        position_code: "RB",
      },
      {
        tournament_id: "WC-1970",
        team_id: "T-07",
        player_id: "P-00004",
        position_code: "CB",
      },
    ];
    const counts = indexAppearancePositionCounts(rows);
    const key = "WC-1970|T-07|P-00004";
    expect(counts.get(key)?.get("RB")).toBe(2);
    expect(counts.get(key)?.get("CB")).toBe(1);
  });
});
