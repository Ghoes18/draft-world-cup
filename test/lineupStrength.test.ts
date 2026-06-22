import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import { demoCatalog } from "../src/demoCatalog.js";
import {
  buildStateToTeamStrength,
  forceToRating,
  lineupToTeamStrength,
  playerOverall,
} from "../src/lineupStrength.js";
import { defaultLineup } from "../src/lineup.js";
import {
  autoFillLineup,
  initBuildState,
} from "../src/roll.js";

describe("forceToRating", () => {
  it("scales 0–255 to ~0–100", () => {
    expect(forceToRating(255)).toBe(100);
    expect(forceToRating(0)).toBe(0);
    expect(forceToRating(128)).toBe(50);
  });
});

describe("playerOverall", () => {
  it("returns catalog overall when present", () => {
    const pele = demoCatalog.players["br70-pelé"]!;
    expect(playerOverall(pele)).toBe(forceToRating(pele.force));
  });
});

describe("lineupToTeamStrength", () => {
  it("uses GK force only in defense weighting", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "t-2000",
          team: "Test",
          cup: 2000,
          players: [
            { id: "gk", name: "GK", naturalPosition: "GK", force: 200 },
            { id: "st", name: "ST", naturalPosition: "ST", force: 240 },
            ...Array.from({ length: 9 }, (_, i) => ({
              id: `p${i}`,
              name: `P${i}`,
              naturalPosition: "CM",
              force: 200,
            })),
          ],
        },
      ],
    });

    const lineup = defaultLineup("home").map((slot, i) => {
      const ids = ["gk", "st", "p0", "p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
      return { ...slot, playerId: ids[i]!, position: slot.position };
    });

    const s = lineupToTeamStrength(cat, lineup);
    expect(s.overall).toBeGreaterThan(70);
    expect(s.attack).toBeGreaterThan(0);
    expect(s.defense).toBeGreaterThan(0);
  });

  it("requires exactly 11 slots", () => {
    expect(() =>
      lineupToTeamStrength(demoCatalog, defaultLineup("home").slice(0, 5)),
    ).toThrow(/11 slots/);
  });
});

describe("buildStateToTeamStrength", () => {
  it("derives strength from autofill XI", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "str-test", "home", scenario.id),
    );
    const s = buildStateToTeamStrength(demoCatalog, filled);
    expect(s.overall).toBeGreaterThan(60);
    expect(s.overall).toBeLessThanOrEqual(100);
  });
});
