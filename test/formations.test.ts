import { describe, expect, it } from "vitest";
import {
  DEFAULT_FORMATION_ID,
  drawFormationOptions,
  formationAnchors,
  getFormation,
  listFormations,
} from "../src/formations.js";
import { initBuildState } from "../src/roll.js";
import { demoCatalog } from "../src/demoCatalog.js";

describe("formations catalog", () => {
  it("lists at least 12 formations", () => {
    expect(listFormations().length).toBeGreaterThanOrEqual(12);
  });

  it("every formation has exactly 11 slots", () => {
    for (const f of listFormations()) {
      expect(f.slots).toHaveLength(11);
      expect(f.slots[0]?.position).toBe("GK");
    }
  });

  it("default formation is 4-3-3 balanced", () => {
    const f = getFormation(DEFAULT_FORMATION_ID);
    expect(f.label).toBe("4-3-3");
    expect(f.mentality).toBe("balanced");
  });

  it("433 defend differs from 433 balanced in anchors", () => {
    const balanced = formationAnchors("433-balanced");
    const defend = formationAnchors("433-defend");
    expect(defend.some((s) => s.position === "CDM")).toBe(true);
    expect(balanced.some((s) => s.position === "CDM")).toBe(false);
    expect(JSON.stringify(balanced)).not.toBe(JSON.stringify(defend));
  });

  it("4231 has a CAM and ST", () => {
    const slots = formationAnchors("4231-balanced");
    expect(slots.some((s) => s.position === "CAM")).toBe(true);
    expect(slots.some((s) => s.position === "ST")).toBe(true);
  });
});

describe("drawFormationOptions", () => {
  it("returns 5 distinct options by default", () => {
    const opts = drawFormationOptions("draft-seed-1");
    expect(opts).toHaveLength(5);
    const ids = new Set(opts.map((o) => o.id));
    expect(ids.size).toBe(5);
  });

  it("is deterministic for the same seed", () => {
    const a = drawFormationOptions("same-draft");
    const b = drawFormationOptions("same-draft");
    expect(a.map((o) => o.id)).toEqual(b.map((o) => o.id));
  });

  it("varies by seed", () => {
    const a = drawFormationOptions("seed-a");
    const b = drawFormationOptions("seed-b");
    expect(a.map((o) => o.id).join(",")).not.toBe(b.map((o) => o.id).join(","));
  });
});

describe("initBuildState formation", () => {
  it("stores formationId on build state", () => {
    const state = initBuildState(
      demoCatalog,
      "form-init",
      "home",
      undefined,
      "532-defensive",
    );
    expect(state.formationId).toBe("532-defensive");
    expect(state.slots.some((s) => s.position === "RWB")).toBe(true);
  });

  it("defaults to 433-balanced when formation omitted", () => {
    const state = initBuildState(demoCatalog, "default-form", "home");
    expect(state.formationId).toBe(DEFAULT_FORMATION_ID);
  });
});
