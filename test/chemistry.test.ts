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
  it("gives full credit for the exact role", () => {
    expect(positionFit("ST", "CF")).toBe(FIT_EXACT); // both → ST
    expect(positionFit("RCB", "LCB")).toBe(FIT_EXACT); // both → CB
  });

  it("gives partial credit for an adjacent role", () => {
    expect(positionFit("CB", "RB")).toBe(FIT_ADJACENT); // CB ↔ FB
    expect(positionFit("CM", "AM")).toBe(FIT_ADJACENT);
  });

  it("gives little credit for an unrelated role", () => {
    expect(positionFit("ST", "CB")).toBe(FIT_UNRELATED);
    expect(positionFit("GK", "ST")).toBe(FIT_UNRELATED); // GK is exact-only
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
