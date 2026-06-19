import { describe, expect, it } from "vitest";
import {
  chemistryBonus,
  effectiveStrength,
  tacticDeltas,
} from "../src/strength.js";
import { TACTIC_DELTA } from "../src/constants.js";
import type { TeamStrength } from "../src/engine.js";

const BASE: TeamStrength = { attack: 80, defense: 80, overall: 80 };

describe("chemistryBonus", () => {
  it("maps the endpoints to ±3 with 50% neutral", () => {
    expect(chemistryBonus(0)).toBe(-3);
    expect(chemistryBonus(50)).toBe(0);
    expect(chemistryBonus(100)).toBe(3);
  });

  it("scales linearly between the endpoints (rounded)", () => {
    expect(chemistryBonus(75)).toBe(2); // round(0.25 * 6) = round(1.5) = 2
    expect(chemistryBonus(83)).toBe(2); // round(0.33 * 6) = round(1.98)
  });

  it("clamps out-of-range input", () => {
    expect(chemistryBonus(-50)).toBe(-3);
    expect(chemistryBonus(200)).toBe(3);
  });
});

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
  it("is a no-op for balanced + 50% chemistry (and the default)", () => {
    expect(effectiveStrength(BASE, { tactic: "balanced", chemistryPct: 50 })).toEqual(
      BASE,
    );
    expect(effectiveStrength(BASE)).toEqual(BASE);
  });

  it("applies chemistry to attack, defense AND overall", () => {
    // 100% chemistry → +3 everywhere; balanced leaves the tactic deltas at 0.
    expect(effectiveStrength(BASE, { chemistryPct: 100 })).toEqual({
      attack: 83,
      defense: 83,
      overall: 83,
    });
  });

  it("applies the tactic δ to attack/defense but not overall", () => {
    expect(effectiveStrength(BASE, { tactic: "offensive" })).toEqual({
      attack: 80 + TACTIC_DELTA,
      defense: 80 - TACTIC_DELTA,
      overall: 80,
    });
  });

  it("composes chemistry and tactics together", () => {
    // chem 80 → +2; offensive → atk +4, def -4.
    expect(effectiveStrength(BASE, { chemistryPct: 80, tactic: "offensive" })).toEqual({
      attack: 80 + 2 + 4,
      defense: 80 + 2 - 4,
      overall: 80 + 2,
    });
  });
});
