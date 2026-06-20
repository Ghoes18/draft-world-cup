import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import { demoCatalog } from "../src/demoCatalog.js";
import {
  autoFillLineup,
  buildChemistryPercent,
  buildStateToLineup,
  drawScenario,
  initBuildState,
  isLineupComplete,
  rerollScenario,
  selectPlayer,
  selectablePlayers,
  validateBuildState,
  validateLineup,
  type BuildState,
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

describe("initBuildState", () => {
  it("starts with turn 0 and a current scenario", () => {
    const state = initBuildState(demoCatalog, "init-test", "home");
    expect(state.turnIndex).toBe(0);
    expect(state.globalRerollsRemaining).toBe(3);
    expect(state.slots).toHaveLength(11);
    expect(state.formationId).toBeDefined();
    expect(
      demoCatalog.scenarios.some((s) => s.id === state.currentScenarioId),
    ).toBe(true);
  });

  it("is deterministic for the same seed", () => {
    const a = initBuildState(demoCatalog, "same-seed", "home");
    const b = initBuildState(demoCatalog, "same-seed", "home");
    expect(a.currentScenarioId).toBe(b.currentScenarioId);
  });
});

describe("selectablePlayers", () => {
  it("only offers players from the current scenario squad", () => {
    const state = initBuildState(demoCatalog, "squad-test", "home");
    const scenario = demoCatalog.scenarios.find(
      (s) => s.id === state.currentScenarioId,
    )!;
    const pool = selectablePlayers(demoCatalog, state);
    for (const p of pool) {
      expect(p.team).toBe(scenario.team);
      expect(p.cup).toBe(scenario.cup);
      expect(scenario.playerIds).toContain(p.id);
    }
    expect(pool.length).toBeGreaterThan(0);
  });

  it("excludes already-selected players", () => {
    let state = initBuildState(demoCatalog, "exclude-test", "home");
    const first = selectablePlayers(demoCatalog, state)[0]!;
    const target = state.slots.find((s) => {
      try {
        selectPlayer(demoCatalog, state, s.slotId, first.id);
        return true;
      } catch {
        return false;
      }
    });
    expect(target).toBeDefined();
    state = selectPlayer(demoCatalog, state, target!.slotId, first.id);
    const pool = selectablePlayers(demoCatalog, state);
    expect(pool.every((p) => p.id !== first.id)).toBe(true);
  });
});

describe("selectPlayer", () => {
  it("advances turn and rolls the next scenario", () => {
    let state = initBuildState(demoCatalog, "advance-test", "home");
    const beforeScenario = state.currentScenarioId;
    const player = selectablePlayers(demoCatalog, state)[0]!;
    const slot = state.slots.find((s) => {
      try {
        selectPlayer(demoCatalog, state, s.slotId, player.id);
        return true;
      } catch {
        return false;
      }
    })!;
    state = selectPlayer(demoCatalog, state, slot.slotId, player.id);
    expect(state.turnIndex).toBe(1);
    expect(state.rerollCounter).toBe(0);
    expect(
      state.slots.find((s) => s.slotId === slot.slotId)?.pickedFromScenarioId,
    ).toBe(beforeScenario);
  });

  it("rejects a player not in the current scenario squad", () => {
    const state = initBuildState(demoCatalog, "reject-test", "home");
    const other = demoCatalog.scenarios.find(
      (s) => s.id !== state.currentScenarioId,
    )!;
    const otherPlayer = other.playerIds[0]!;
    expect(() =>
      selectPlayer(demoCatalog, state, "0", otherPlayer),
    ).toThrow();
  });
});

describe("rerollScenario", () => {
  it("full reroll changes scenario and consumes a global reroll", () => {
    const state = initBuildState(demoCatalog, "reroll-full", "home");
    const before = state.currentScenarioId;
    const after = rerollScenario(demoCatalog, state, "full");
    expect(after.globalRerollsRemaining).toBe(2);
    expect(after.rerollCounter).toBe(1);
    expect(after.currentScenarioId).toBeDefined();
    // Deterministic: same state → same reroll outcome.
    const again = rerollScenario(demoCatalog, state, "full");
    expect(again.currentScenarioId).toBe(after.currentScenarioId);
    expect(before).toBeDefined();
  });

  it("year reroll keeps the same team", () => {
    const cat = normalizeCatalog({
      scenarios: [
        {
          id: "brazil-1970",
          team: "Brazil",
          cup: 1970,
          players: [
            { id: "b1", name: "A", naturalPosition: "GK", force: 200 },
            { id: "b2", name: "B", naturalPosition: "ST", force: 220 },
          ],
        },
        {
          id: "brazil-1994",
          team: "Brazil",
          cup: 1994,
          players: [
            { id: "b3", name: "C", naturalPosition: "GK", force: 210 },
            { id: "b4", name: "D", naturalPosition: "ST", force: 230 },
          ],
        },
        {
          id: "italy-1982",
          team: "Italy",
          cup: 1982,
          players: [
            { id: "i1", name: "E", naturalPosition: "GK", force: 205 },
            { id: "i2", name: "F", naturalPosition: "ST", force: 215 },
          ],
        },
      ],
    });
    const state = {
      ...initBuildState(cat, "year-reroll", "home"),
      currentScenarioId: "brazil-1970",
    };
    const after = rerollScenario(cat, state, "year");
    const scenario = cat.scenarios.find((s) => s.id === after.currentScenarioId)!;
    expect(scenario.team).toBe("Brazil");
    expect(scenario.cup).not.toBe(1970);
    expect(after.globalRerollsRemaining).toBe(2);
  });

  it("throws when global rerolls are exhausted", () => {
    let state = initBuildState(demoCatalog, "reroll-limit", "home");
    state = rerollScenario(demoCatalog, state, "full");
    state = rerollScenario(demoCatalog, state, "full");
    state = rerollScenario(demoCatalog, state, "full");
    expect(state.globalRerollsRemaining).toBe(0);
    expect(() => rerollScenario(demoCatalog, state, "full")).toThrow(
      /no global rerolls/,
    );
  });
});

describe("validateBuildState", () => {
  it("rejects duplicate players", () => {
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "dup-test", "home"),
    );
    const firstId = filled.slots[0]!.selectedPlayerId!;
    const firstScenario = filled.slots[0]!.pickedFromScenarioId!;
    const dup: BuildState = {
      ...filled,
      slots: filled.slots.map((s, i) =>
        i === 1
          ? {
              ...s,
              selectedPlayerId: firstId,
              pickedFromScenarioId: firstScenario,
            }
          : s,
      ),
    };
    const result = validateBuildState(demoCatalog, dup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "duplicate_player")).toBe(true);
  });

  it("accepts a completed autofill draft", () => {
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "valid-test", "home"),
    );
    expect(isLineupComplete(filled)).toBe(true);
    const result = validateBuildState(demoCatalog, filled);
    expect(result.ok).toBe(true);
  });
});

describe("validateLineup", () => {
  it("rejects players from another scenario", () => {
    const scenario = demoCatalog.scenarios[0]!;
    const other = demoCatalog.scenarios[1]!;
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "wrong-scenario", "home"),
    );
    const lineup = buildStateToLineup(demoCatalog, filled);
    lineup[0] = { ...lineup[0]!, playerId: other.playerIds[0]! };
    const result = validateLineup(demoCatalog, scenario.id, lineup);
    expect(result.ok).toBe(false);
    expect(result.errors.some((e) => e.code === "wrong_scenario")).toBe(true);
  });
});

describe("autoFillLineup", () => {
  it("completes all 11 slots over 11 turns", () => {
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "autofill", "home"),
    );
    expect(filled.slots.every((s) => s.selectedPlayerId)).toBe(true);
    expect(filled.turnIndex).toBe(11);
    const validation = validateBuildState(demoCatalog, filled);
    expect(validation.ok).toBe(true);
  });
});

describe("buildChemistryPercent", () => {
  it("reflects placement quality after autofill", () => {
    const filled = autoFillLineup(
      demoCatalog,
      initBuildState(demoCatalog, "chem-test", "home"),
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
