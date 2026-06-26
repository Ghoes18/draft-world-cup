import { describe, expect, it } from "vitest";
import { attackWeight, defenseWeight } from "../src/positions.js";

describe("position weights", () => {
  it("weights core role codes by how advanced they are", () => {
    expect(attackWeight("ST")).toBe(1);
    expect(defenseWeight("ST")).toBe(0);
    expect(attackWeight("CB")).toBe(0);
    expect(defenseWeight("CB")).toBe(1);
    expect(attackWeight("CM")).toBe(0.5);
    expect(defenseWeight("CM")).toBe(0.5);
    expect(attackWeight("GK")).toBe(0);
    expect(defenseWeight("GK")).toBe(1);
  });

  it("treats side-prefixed detail codes like their core role (regression)", () => {
    // These are emitted verbatim by formations (4-4-2, 4-2-3-1, 3-5-2 …) and
    // previously fell through to the midfielder default — a strike pair scored
    // like central midfielders, deflating a team's attack rating.
    expect(attackWeight("RST")).toBe(attackWeight("ST"));
    expect(attackWeight("LST")).toBe(1);
    expect(attackWeight("RAM")).toBe(attackWeight("AM"));
    expect(defenseWeight("RCDM")).toBe(defenseWeight("DM"));
    expect(defenseWeight("LWB")).toBe(defenseWeight("RB")); // wing-back ≈ full-back
  });

  it("falls back to a balanced midfielder for unknown codes", () => {
    expect(attackWeight("???")).toBe(0.5);
    expect(defenseWeight("???")).toBe(0.5);
  });
});
