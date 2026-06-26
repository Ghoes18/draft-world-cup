import { describe, expect, it } from "vitest";
import {
  effectiveStrength,
  tacticDeltas,
} from "../src/strength.js";
import { TACTIC_DELTA } from "../src/constants.js";
import type { TeamStrength } from "../src/engine.js";

const BASE: TeamStrength = { attack: 80, midfield: 80, defense: 80, overall: 80 };

describe("tacticDeltas", () => {
  it("trades δ between attack and defense", () => {
    expect(tacticDeltas("offensive")).toEqual({
      attack: TACTIC_DELTA,
      defense: -TACTIC_DELTA,
    });
    expect(tacticDeltas("defensive")).toEqual({
      attack: -TACTIC_DELTA,
      defense: TACTIC_DELTA,
    });
    expect(tacticDeltas("balanced")).toEqual({ attack: 0, defense: 0 });
  });
});

describe("effectiveStrength", () => {
  it("is a no-op for balanced (and the default)", () => {
    expect(effectiveStrength(BASE, { tactic: "balanced" })).toEqual(BASE);
    expect(effectiveStrength(BASE)).toEqual(BASE);
  });

  it("applies the tactic δ to attack/defense but not midfield/overall", () => {
    expect(effectiveStrength(BASE, { tactic: "offensive" })).toEqual({
      attack: 80 + TACTIC_DELTA,
      midfield: 80,
      defense: 80 - TACTIC_DELTA,
      overall: 80,
    });
  });

  it("lifts attack/midfield/defense by the chemistry bonus, then applies tactics", () => {
    expect(
      effectiveStrength(BASE, { tactic: "offensive", chemistryBonus: 3 }),
    ).toEqual({
      attack: 80 + 3 + TACTIC_DELTA,
      midfield: 80 + 3,
      defense: 80 + 3 - TACTIC_DELTA,
      overall: 80,
    });
  });

  it("lifts overall (only) by the legend bonus", () => {
    expect(effectiveStrength(BASE, { legendBonus: 4 })).toEqual({
      attack: 80,
      midfield: 80,
      defense: 80,
      overall: 84,
    });
  });
});
