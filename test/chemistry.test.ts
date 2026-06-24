import { describe, expect, it } from "vitest";
import {
  canonicalRole,
  chemistryPercent,
  positionFit,
} from "../src/chemistry.js";
import { FIT_ADJACENT, FIT_EXACT, FIT_UNRELATED } from "../src/constants.js";
import { defaultLineup } from "../src/lineup.js";

describe("canonicalRole", () => {
  it("normalizes side-qualified and synonym codes", () => {
    expect(canonicalRole("RCB")).toBe("CB");
    expect(canonicalRole("LCB")).toBe("CB");
    expect(canonicalRole("RB")).toBe("FB");
    expect(canonicalRole("LWB")).toBe("FB");
    expect(canonicalRole("RCM")).toBe("CM");
    expect(canonicalRole("LW")).toBe("W");
    expect(canonicalRole("CF")).toBe("ST");
    expect(canonicalRole("gk")).toBe("GK");
  });

  it("returns null for unknown codes", () => {
    expect(canonicalRole("XYZ")).toBeNull();
  });
});

describe("positionFit", () => {
  it("gives full credit for the exact detail code", () => {
    expect(positionFit("RCB", "RCB")).toBe(1);
    expect(positionFit("LW", "LW")).toBe(1);
  });

  it("gives same-role central credit for detail synonyms", () => {
    expect(positionFit("ST", "CF")).toBe(0.85);
  });

  it("gives side-aware credit for detail positions", () => {
    expect(positionFit("RCB", "LCB")).toBe(0.55);
  });

  it("gives partial credit for an adjacent detail role", () => {
    expect(positionFit("CB", "RB")).toBe(0.28);
    expect(positionFit("CM", "RAM")).toBe(0.28);
  });

  it("falls back to coarse scoring for non-detail codes", () => {
    expect(positionFit("MF", "MF")).toBe(FIT_EXACT);
    expect(positionFit("MF", "FW")).toBe(FIT_UNRELATED);
  });

  it("gives little credit for an unrelated role", () => {
    expect(positionFit("ST", "CB")).toBe(0.1);
    expect(positionFit("GK", "ST")).toBe(0.05);
  });

  it("treats unknown codes as unrelated", () => {
    expect(positionFit("???", "ST")).toBe(FIT_UNRELATED);
  });
});

describe("chemistryPercent", () => {
  it("is 0 for an empty lineup", () => {
    expect(chemistryPercent([])).toBe(0);
  });

  it("is 100 for a perfectly-placed XI", () => {
    const placements = defaultLineup("home").map((s) => ({
      natural: s.position,
      assigned: s.position,
    }));
    expect(chemistryPercent(placements)).toBe(100);
  });

  it("drops when players are shifted out of position", () => {
    const slots = defaultLineup("home");
    const placements = slots.map((s, i) => ({
      // Field the striker (last slot) at centre-back: an unrelated fit.
      natural: s.position,
      assigned: i === slots.length - 1 ? "RCB" : s.position,
    }));
    expect(chemistryPercent(placements)).toBeLessThan(100);
    expect(chemistryPercent(placements)).toBeGreaterThan(0);
  });
});
