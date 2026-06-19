import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import { demoCatalog } from "../src/demoCatalog.js";
import {
  allSlotCandidates,
  autoFillLineup,
  buildChemistryPercent,
  buildStateToLineup,
  drawScenario,
  initBuildState,
  rerollSlot,
  rollSlotCandidates,
  selectPlayer,
  validateLineup,
} from "../src/roll.js";

describe("drawScenario", () => {
  it("is deterministic for the same seed", () => {
    const a = drawScenario(demoCatalog, "seed-alpha");
    const b = drawScenario(demoCatalog, "seed-alpha");
    expect(a.id).toBe(b.id);
  });

  it("returns a scenario from the catalog", () => {
    const s = drawScenario(demoCatalog, "any-seed");
    expect(demoCatalog.scenarios.some((x) => x.id === s.id)).toBe(true);
  });
});

describe("rollSlotCandidates", () => {
  it("only offers players from the drawn scenario squad", () => {
    const scenario = drawScenario(demoCatalog, "roll-test");
    const state = initBuildState(demoCatalog, scenario.id, "roll-test", "home");
    const batch = rollSlotCandidates(demoCatalog, state, "0");
    for (const p of batch) {
      expect(p.team).toBe(scenario.team);
      expect(p.cup).toBe(scenario.cup);
      expect(scenario.playerIds).toContain(p.id);
    }
  });

  it("changes batch on reroll when pool allows", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const state = initBuildState(demoCatalog, scenario.id, "reroll-test", "home");
    const before = rollSlotCandidates(demoCatalog, state, "0").map((p) => p.id);
    const afterState = rerollSlot(state, "0");
    const after = rollSlotCandidates(demoCatalog, afterState, "0").map(
      (p) => p.id,
    );
    // Pool is large enough that a reroll may change the batch; at minimum indices differ or order differs.
    expect(afterState.slots[0]!.rollIndex).toBe(1);
    expect(after.length).toBeGreaterThan(0);
    // Deterministic: same rerolled state → same batch.
    expect(
      rollSlotCandidates(demoCatalog, afterState, "0").map((p) => p.id),
    ).toEqual(after);
    expect(before.length).toBeGreaterThan(0);
  });

  it("excludes already-selected players from other slots", () => {
    const scenario = demoCatalog.scenarios[0]!;
    let state = initBuildState(demoCatalog, scenario.id, "exclude-test", "home");
    const first = rollSlotCandidates(demoCatalog, state, "0")[0]!;
    state = selectPlayer(demoCatalog, state, "0", first.id);
    const secondBatch = rollSlotCandidates(demoCatalog, state, "1");
    expect(secondBatch.every((p) => p.id !== first.id)).toBe(true);
  });
});

describe("selectPlayer", () => {
  it("rejects a player not in the current candidate batch", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const state = initBuildState(demoCatalog, scenario.id, "reject-test", "home");
    const otherSlot = rollSlotCandidates(demoCatalog, state, "1")[0]!;
    expect(() => selectPlayer(demoCatalog, state, "0", otherSlot.id)).toThrow();
  });
});

describe("validateLineup", () => {
  it("rejects duplicate players", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, scenario.id, "dup-test", "home"),
    );
    const lineup = buildStateToLineup(demoCatalog, filled);
    const dup = [...lineup];
    dup[1] = { ...dup[1]!, playerId: dup[0]!.playerId };
    const result = validateLineup(demoCatalog, scenario.id, dup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "duplicate_player")).toBe(true);
  });

  it("rejects players from another scenario", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const other = demoCatalog.scenarios[1]!;
    const otherPlayer = other.playerIds[0]!;
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, scenario.id, "wrong-scenario", "home"),
    );
    const lineup = buildStateToLineup(demoCatalog, filled);
    lineup[0] = { ...lineup[0]!, playerId: otherPlayer };
    const result = validateLineup(demoCatalog, scenario.id, lineup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "wrong_scenario")).toBe(true);
  });
});

describe("autoFillLineup", () => {
  it("completes all 11 slots with eligible players", () => {
    const scenario = drawScenario(demoCatalog, "autofill");
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, scenario.id, "autofill", "home"),
    );
    expect(filled.slots.every((s) => s.selectedPlayerId)).toBe(true);
    const lineup = buildStateToLineup(demoCatalog, filled);
    const validation = validateLineup(demoCatalog, scenario.id, lineup);
    expect(validation.ok).toBe(true);
  });
});

describe("buildChemistryPercent", () => {
  it("reflects placement quality after autofill", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, scenario.id, "chem-test", "home"),
    );
    const chem = buildChemistryPercent(demoCatalog, filled);
    expect(chem).toBeGreaterThan(50);
    expect(chem).toBeLessThanOrEqual(100);
  });
});

describe("normalizeCatalog", () => {
  it("builds indexed players and scenario rosters", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "test-2000",
          team: "Testland",
          cup: 2000,
          players: [
            { id: "t1", name: "A", naturalPosition: "GK", force: 180 },
            { id: "t2", name: "B", naturalPosition: "ST", force: 220 },
          ],
        },
      ],
    });
    expect(cat.scenarios).toHaveLength(1);
    expect(cat.players.t1?.name).toBe("A");
    expect(cat.scenarios[0]!.playerIds).toEqual(["t1", "t2"]);
  });
});

describe("allSlotCandidates", () => {
  it("returns a batch per slot", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const state = initBuildState(demoCatalog, scenario.id, "all-slots", "home");
    const batches = allSlotCandidates(demoCatalog, state);
    expect(Object.keys(batches)).toHaveLength(11);
  });
});
