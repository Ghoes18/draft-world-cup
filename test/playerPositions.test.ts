import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { normalizeCatalog, hydrateCatalog } from "../src/catalog.js";
import { demoCatalog } from "../src/demoCatalog.js";
import {
  canPlayInSlot,
  formatPlacementOptions,
  formatPlayerPositions,
  formatPositionList,
  playerPlayablePositions,
} from "../src/playerPositions.js";
import { playerOverall } from "../src/playerRating.js";
import {
  initBuildState,
  openSlotsForPlayer,
  selectablePlayers,
  autoFillLineup,
  isLineupComplete,
} from "../src/roll.js";
import { lineupToTeamStrength } from "../src/lineupStrength.js";
import { defaultLineup } from "../src/lineup.js";

describe("playerPlayablePositions", () => {
  it("returns formation variants for explicit API positions", () => {
    const maradona = demoCatalog.players["ar86-maradona"]!;
    expect(playerPlayablePositions(maradona)).toContain("CAM");
    expect(playerPlayablePositions(maradona)).toContain("LW");
    expect(playerPlayablePositions(maradona)).not.toContain("CB");
  });

  it("falls back to natural position variants when no list", () => {
    const pele = demoCatalog.players["br70-pelé"]!;
    expect(playerPlayablePositions(pele)).toContain("ST");
  });

  it("formatPlayerPositions shows API codes not expanded slots", () => {
    const maradona = demoCatalog.players["ar86-maradona"]!;
    expect(formatPlayerPositions(maradona)).toBe("CM · AM · LW · CF");
  });

  it("formatPlayerPositions shows L/R flanks for inferred defenders", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "t-2000",
          team: "Test",
          cup: 2000,
          players: [
            {
              id: "df",
              name: "Def",
              naturalPosition: "CB",
              positions: ["CB", "LB", "RB", "LCB", "RCB"],
              positionSource: "inferred",
              force: 200,
            },
          ],
        },
      ],
    });
    expect(formatPlayerPositions(cat.players["df"]!)).toBe(
      "LB · RB · LCB · RCB",
    );
  });
});

describe("formatPlacementOptions", () => {
  it("matches placement button labels", () => {
    expect(
      formatPlacementOptions([
        { position: "RB" },
        { position: "LCB" },
        { position: "LB" },
      ]),
    ).toBe("RB · LCB · LB");
  });
});

describe("canPlayInSlot", () => {
  it("restricts ST-only API players to striker slots", () => {
    const valdano = demoCatalog.players["ar86-valdano"]!;
    expect(canPlayInSlot(valdano, "ST")).toBe(true);
    expect(canPlayInSlot(valdano, "RST")).toBe(true);
    expect(canPlayInSlot(valdano, "CF")).toBe(true);
    expect(canPlayInSlot(valdano, "LW")).toBe(false);
    expect(canPlayInSlot(valdano, "CAM")).toBe(false);
    expect(canPlayInSlot(valdano, "CM")).toBe(false);
  });

  it("allows Maradona only in listed API positions", () => {
    const maradona = demoCatalog.players["ar86-maradona"]!;
    expect(canPlayInSlot(maradona, "CAM")).toBe(true);
    expect(canPlayInSlot(maradona, "CF")).toBe(true);
    expect(canPlayInSlot(maradona, "LW")).toBe(true);
    expect(canPlayInSlot(maradona, "CM")).toBe(true);
    expect(canPlayInSlot(maradona, "CB")).toBe(false);
    expect(canPlayInSlot(maradona, "GK")).toBe(false);
    expect(canPlayInSlot(maradona, "RW")).toBe(false);
  });

  it("expands inferred Fjelstul CB to full-back slots", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "t-2000",
          team: "Test",
          cup: 2000,
          players: [
            {
              id: "df",
              name: "Def",
              naturalPosition: "CB",
              positions: ["CB"],
              positionSource: "inferred",
              force: 200,
            },
            ...Array.from({ length: 22 }, (_, i) => ({
              id: `f${i}`,
              name: `F${i}`,
              naturalPosition: "GK",
              positions: ["GK"],
              positionSource: "inferred" as const,
              force: 180,
            })),
          ],
        },
      ],
    });
    const df = cat.players["df"]!;
    expect(canPlayInSlot(df, "RB")).toBe(true);
    expect(canPlayInSlot(df, "RCB")).toBe(true);
  });
});

describe("formatPositionList", () => {
  it("orders roles defensively to attack", () => {
    expect(formatPositionList(["ST", "CM", "LW", "AM"])).toBe(
      "CM · AM · LW · ST",
    );
  });
});

describe("playerOverall", () => {
  it("prefers API overall over force scaling", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "t-2000",
          team: "Test",
          cup: 2000,
          players: [
            {
              id: "p1",
              name: "Star",
              naturalPosition: "ST",
              force: 100,
              overall: 88,
            },
          ],
        },
      ],
    });
    expect(playerOverall(cat.players["p1"]!)).toBe(88);
  });
});

describe("lineupToTeamStrength uses overall", () => {
  it("aggregates player overall not raw force when API overall is set", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "t-2000",
          team: "Test",
          cup: 2000,
          players: [
            { id: "gk", name: "GK", naturalPosition: "GK", force: 50, overall: 80 },
            { id: "st", name: "ST", naturalPosition: "ST", force: 50, overall: 90 },
            ...Array.from({ length: 9 }, (_, i) => ({
              id: `p${i}`,
              name: `P${i}`,
              naturalPosition: "CM",
              force: 50,
              overall: 70,
            })),
          ],
        },
      ],
    });
    const lineup = defaultLineup("home").map((slot, i) => {
      const ids = ["gk", "st", "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
      return { ...slot, playerId: ids[i]! };
    });
    const s = lineupToTeamStrength(cat, lineup);
    expect(s.overall).toBeGreaterThan(65);
    expect(s.overall).toBeLessThan(85);
  });
});

describe("autoFillLineup with inferred catalog positions", () => {
  it("completes opponent XI on the full Fjelstul catalog", () => {
    const catalogPath = resolve("apps/web/public/catalog.json");
    const catalog = hydrateCatalog(JSON.parse(readFileSync(catalogPath, "utf8")));
    const filled = autoFillLineup(
      catalog,
      initBuildState(
        catalog,
        "repro-morocco:away",
        "away",
        "morocco-1986",
        "433-balanced",
      ),
    );
    expect(isLineupComplete(filled)).toBe(true);
  });
});

describe("openSlotsForPlayer with positions", () => {
  it("offers Maradona more slots than a pure striker on Argentina 1986", () => {
    const state = initBuildState(
      demoCatalog,
      "pos-test",
      "home",
      "argentina-1986",
    );
    const maradona = demoCatalog.players["ar86-maradona"]!;
    const valdano = demoCatalog.players["ar86-valdano"]!;
    const maradonaSlots = openSlotsForPlayer(demoCatalog, state, maradona.id);
    const valdanoSlots = openSlotsForPlayer(demoCatalog, state, valdano.id);
    expect(maradonaSlots.length).toBeGreaterThan(valdanoSlots.length);
    expect(valdanoSlots.every((s) => s.position === "ST")).toBe(true);
  });

  it("includes Maradona in selectable pool when CAM slot is open", () => {
    const state = initBuildState(
      demoCatalog,
      "pos-pool",
      "home",
      "argentina-1986",
      "433-attack",
    );
    const pool = selectablePlayers(demoCatalog, state);
    expect(pool.some((p) => p.id === "ar86-maradona")).toBe(true);
    const maradonaSlots = openSlotsForPlayer(
      demoCatalog,
      state,
      "ar86-maradona",
    );
    expect(maradonaSlots.some((s) => s.position === "CAM")).toBe(true);
    expect(
      maradonaSlots.some((s) => s.position === "CF" || s.position === "ST"),
    ).toBe(true);
  });
});
