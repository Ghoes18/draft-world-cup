import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import { defaultLineup } from "../src/lineup.js";
import { lineupSynergy } from "../src/synergy.js";
import { LEGEND_OVERALL_CAP } from "../src/constants.js";

/** Build an 11-player catalog + lineup from a flat spec, one player per slot. */
function makeLineup(spec: { team: string; cup: number; name: string }[]) {
  const players = spec.map((p, i) => ({
    id: `p${i}`,
    name: p.name,
    naturalPosition: "CM",
    force: 200,
  }));
  // Each player belongs to its own scenario so teams/cups can differ freely.
  const cat = normalizeCatalog({
    scenarios: spec.map((p, i) => ({
      id: `s${i}`,
      team: p.team,
      cup: p.cup,
      players: [players[i]!],
    })),
  });
  const lineup = defaultLineup("home").map((slot, i) => ({
    ...slot,
    playerId: `p${i}`,
  }));
  return lineupSynergy(cat, lineup);
}

const NOBODY = "Random Nobody";

describe("lineupSynergy chemistry", () => {
  it("sits at a neutral 50% with no shared nations (bonus-only floor)", () => {
    const s = makeLineup(
      Array.from({ length: 11 }, (_, i) => ({
        team: `Nation${i}`,
        cup: 2000 + i,
        name: `${NOBODY} ${i}`,
      })),
    );
    expect(s.chemistryPercent).toBe(50);
    expect(s.chemistryBonus).toBe(0);
  });

  it("saturates to 100% → +3 for a fully cohesive squad", () => {
    const s = makeLineup(
      Array.from({ length: 11 }, (_, i) => ({
        team: "Brazil",
        cup: 1970,
        name: `${NOBODY} ${i}`,
      })),
    );
    expect(s.chemistryPercent).toBe(100);
    expect(s.chemistryBonus).toBe(3);
  });

  it("weights real teammates above mere countrymen", () => {
    const teammates = makeLineup([
      { team: "Brazil", cup: 1970, name: "A" },
      { team: "Brazil", cup: 1970, name: "B" },
      ...Array.from({ length: 9 }, (_, i) => ({
        team: `Nation${i}`,
        cup: 2000 + i,
        name: `${NOBODY} ${i}`,
      })),
    ]);
    const countrymen = makeLineup([
      { team: "Brazil", cup: 1970, name: "A" },
      { team: "Brazil", cup: 1994, name: "B" },
      ...Array.from({ length: 9 }, (_, i) => ({
        team: `Nation${i}`,
        cup: 2000 + i,
        name: `${NOBODY} ${i}`,
      })),
    ]);
    expect(teammates.chemistryPercent).toBeGreaterThan(
      countrymen.chemistryPercent,
    );
  });
});

describe("lineupSynergy legends", () => {
  it("counts legends by name and applies +1 each", () => {
    const s = makeLineup([
      { team: "Argentina", cup: 1986, name: "Maradona" },
      ...Array.from({ length: 10 }, (_, i) => ({
        team: `Nation${i}`,
        cup: 2000 + i,
        name: `${NOBODY} ${i}`,
      })),
    ]);
    expect(s.legendCount).toBe(1);
    expect(s.legendBonus).toBe(1);
  });

  it("caps the legend bonus", () => {
    const s = makeLineup(
      Array.from({ length: 11 }, () => ({
        team: "Argentina",
        cup: 1986,
        name: "Maradona",
      })),
    );
    expect(s.legendCount).toBe(11);
    expect(s.legendBonus).toBe(LEGEND_OVERALL_CAP);
  });
});
