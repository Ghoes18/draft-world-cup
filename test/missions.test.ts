import { describe, expect, it } from "vitest";
import { normalizeCatalog } from "../src/catalog.js";
import type { MatchResult } from "../src/engine.js";
import {
  activeMissions,
  applyMatchToStats,
  buildMatchOutcome,
  dailyMissions,
  emptyPlayerStats,
  evaluateMission,
  missionById,
  type MatchOutcome,
  type MissionDef,
  type PlayerStats,
} from "../src/missions.js";
import type { BuildState } from "../src/roll.js";

function outcome(over: Partial<MatchOutcome> = {}): MatchOutcome {
  const base: MatchOutcome = {
    scoreFor: 0,
    scoreAgainst: 0,
    won: false,
    cleanSheet: true,
    nations: {},
    legendIds: [],
    beatBoss: false,
    ...over,
  };
  // Keep cleanSheet consistent unless a test sets it explicitly.
  if (!("cleanSheet" in over)) base.cleanSheet = base.scoreAgainst === 0;
  return base;
}

function statsFor(over: Partial<PlayerStats> = {}): PlayerStats {
  return { ...emptyPlayerStats(), ...over };
}

function def(predicate: MissionDef["predicate"]): MissionDef {
  return {
    id: "test",
    type: "daily",
    category: "result",
    title: "t",
    description: "d",
    predicate,
  };
}

describe("evaluateMission — single match", () => {
  it("win-margin needs a win by the margin", () => {
    const m = def({ kind: "win-margin", min: 3 });
    expect(evaluateMission(m, outcome({ won: true, scoreFor: 4, scoreAgainst: 1 }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ won: true, scoreFor: 4, scoreAgainst: 2 }), emptyPlayerStats()).completed).toBe(false);
    // A 3-goal lead in a non-win (impossible, but guards the `won` clause).
    expect(evaluateMission(m, outcome({ won: false, scoreFor: 3, scoreAgainst: 0 }), emptyPlayerStats()).completed).toBe(false);
  });

  it("win-to-nil needs a clean-sheet win of minGoals", () => {
    const m = def({ kind: "win-to-nil", minGoals: 7 });
    expect(evaluateMission(m, outcome({ won: true, scoreFor: 7, scoreAgainst: 0 }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ won: true, scoreFor: 8, scoreAgainst: 0 }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ won: true, scoreFor: 7, scoreAgainst: 1 }), emptyPlayerStats()).completed).toBe(false);
  });

  it("clean-sheet ignores the win requirement", () => {
    const m = def({ kind: "clean-sheet" });
    expect(evaluateMission(m, outcome({ scoreAgainst: 0, won: false }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ scoreAgainst: 1 }), emptyPlayerStats()).completed).toBe(false);
  });

  it("field-nation counts fielded players of a nation", () => {
    const m = def({ kind: "field-nation", nation: "Brazil", count: 3 });
    expect(evaluateMission(m, outcome({ nations: { Brazil: 3 } }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ nations: { Brazil: 2, Italy: 9 } }), emptyPlayerStats()).completed).toBe(false);
  });

  it("beat-boss only fires when the outcome flags it", () => {
    const m = def({ kind: "beat-boss" });
    expect(evaluateMission(m, outcome({ beatBoss: true }), emptyPlayerStats()).completed).toBe(true);
    expect(evaluateMission(m, outcome({ beatBoss: false }), emptyPlayerStats()).completed).toBe(false);
  });
});

describe("evaluateMission — cumulative", () => {
  it("total-goals / win-count / clean-sheet-count track stats with capped progress", () => {
    expect(evaluateMission(def({ kind: "total-goals", target: 50 }), outcome(), statsFor({ totalGoals: 40 }))).toEqual({ progress: 40, target: 50, completed: false });
    expect(evaluateMission(def({ kind: "total-goals", target: 50 }), outcome(), statsFor({ totalGoals: 80 }))).toEqual({ progress: 50, target: 50, completed: true });
    expect(evaluateMission(def({ kind: "win-count", target: 10 }), outcome(), statsFor({ wins: 10 })).completed).toBe(true);
    expect(evaluateMission(def({ kind: "clean-sheet-count", target: 3 }), outcome(), statsFor({ cleanSheets: 2 })).completed).toBe(false);
  });

  it("legend-count tracks distinct legends; field-legends needs the specific set", () => {
    const goats = def({ kind: "field-legends", legendIds: ["Cristiano Ronaldo", "Messi"] });
    expect(evaluateMission(goats, outcome(), statsFor({ legendIds: ["messi"] }))).toEqual({ progress: 1, target: 2, completed: false });
    expect(evaluateMission(goats, outcome(), statsFor({ legendIds: ["messi", "cristianoronaldo"] })).completed).toBe(true);
    expect(evaluateMission(def({ kind: "legend-count", target: 5 }), outcome(), statsFor({ legendIds: ["a", "b", "c"] })).progress).toBe(3);
  });
});

describe("applyMatchToStats", () => {
  it("sums goals/wins/clean sheets and unions legends + nations", () => {
    const first = applyMatchToStats(
      emptyPlayerStats(),
      outcome({ scoreFor: 3, won: true, cleanSheet: true, legendIds: ["messi"], nations: { Argentina: 11 } }),
    );
    expect(first).toMatchObject({ totalGoals: 3, wins: 1, cleanSheets: 1 });
    const second = applyMatchToStats(
      first,
      outcome({ scoreFor: 2, won: false, cleanSheet: false, legendIds: ["messi", "cristianoronaldo"], nations: { Portugal: 11 } }),
    );
    expect(second.totalGoals).toBe(5);
    expect(second.wins).toBe(1);
    expect(second.cleanSheets).toBe(1);
    expect([...second.legendIds].sort()).toEqual(["cristianoronaldo", "messi"]);
    expect([...second.nations].sort()).toEqual(["Argentina", "Portugal"]);
  });
});

describe("dailyMissions", () => {
  it("is deterministic per date and draws distinct daily missions", () => {
    const a = dailyMissions("2026-06-26");
    const b = dailyMissions("2026-06-26");
    expect(a.map((m) => m.id)).toEqual(b.map((m) => m.id));
    expect(a).toHaveLength(3);
    expect(new Set(a.map((m) => m.id)).size).toBe(3);
    expect(a.every((m) => m.type === "daily")).toBe(true);
  });

  it("varies across dates", () => {
    const a = dailyMissions("2026-06-26").map((m) => m.id);
    const b = dailyMissions("2026-07-15").map((m) => m.id);
    expect(a).not.toEqual(b);
  });

  it("activeMissions appends every persistent mission", () => {
    const active = activeMissions("2026-06-26");
    const persistent = active.filter((m) => m.type === "persistent");
    expect(persistent.length).toBeGreaterThan(0);
    expect(active.length).toBe(3 + persistent.length);
  });
});

describe("buildMatchOutcome", () => {
  // normalizeCatalog assigns each player the scenario's team, so nations are
  // modelled as separate scenarios.
  const catalog = normalizeCatalog({
    scenarios: [
      {
        id: "argentina",
        team: "Argentina",
        cup: 2022,
        players: [
          { id: "p-messi", name: "Messi", naturalPosition: "RW", force: 230, overall: 93, positions: ["RW", "CF"], positionSource: "inferred" },
          { id: "p-joe", name: "Joe Nobody", naturalPosition: "CB", force: 120, overall: 70, positions: ["CB"], positionSource: "inferred" },
        ],
      },
      {
        id: "portugal",
        team: "Portugal",
        cup: 2018,
        players: [
          { id: "p-cr7", name: "Cristiano Ronaldo", naturalPosition: "ST", force: 225, overall: 92, positions: ["ST", "LW"], positionSource: "inferred" },
        ],
      },
    ],
  });

  function homeState(playerIds: string[]): BuildState {
    return {
      slots: playerIds.map((id, i) => ({ slotId: String(i), position: "CM", anchor: { x: 0.5, y: 0.5 }, selectedPlayerId: id })),
    } as unknown as BuildState;
  }

  function result(score: [number, number], winner: MatchResult["winner"]): MatchResult {
    return { score, regulation: score, lambda: [1, 1], knockout: false, winner } as MatchResult;
  }

  it("derives nations, legends, and result-derived flags", () => {
    const o = buildMatchOutcome(catalog, homeState(["p-messi", "p-cr7", "p-joe"]), result([7, 0], "home"), { beatBoss: true });
    expect(o.nations).toEqual({ Argentina: 2, Portugal: 1 });
    expect([...o.legendIds].sort()).toEqual(["cristianoronaldo", "messi"]);
    expect(o.scoreFor).toBe(7);
    expect(o.won).toBe(true);
    expect(o.cleanSheet).toBe(true);
    expect(o.beatBoss).toBe(true);
  });

  it("non-legends never enter the legend set; beatBoss defaults false", () => {
    const o = buildMatchOutcome(catalog, homeState(["p-joe"]), result([0, 1], "away"));
    expect(o.legendIds).toEqual([]);
    expect(o.won).toBe(false);
    expect(o.cleanSheet).toBe(false);
    expect(o.beatBoss).toBe(false);
  });
});

describe("missionById", () => {
  it("resolves known ids and rejects unknown ones", () => {
    expect(missionById("p-two-goats")?.title).toBe("2 GOATs");
    expect(missionById("nope")).toBeUndefined();
  });
});
