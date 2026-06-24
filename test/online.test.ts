import { describe, expect, it } from "vitest";
import { demoCatalog } from "../src/demoCatalog.js";
import { DEFAULT_FORMATION_ID } from "../src/formations.js";
import {
  initBuildState,
  isLineupComplete,
  openSlotsForPlayer,
  selectPlayer,
  selectablePlayers,
  type BuildState,
} from "../src/roll.js";
import { slotFitForPlayer } from "../src/playerPositions.js";
import {
  replayAndValidate,
  replayBuild,
  resolveDuel,
  type BuildAction,
} from "../src/online.js";

/**
 * Play a greedy draft (same heuristic as `autoFillLineup`) while recording the
 * pick actions, so the log can be replayed server-side and compared. No rerolls
 * — those are exercised separately.
 */
function recordGreedyDraft(
  seed: string,
  formationId: string = DEFAULT_FORMATION_ID,
): { state: BuildState; actions: BuildAction[] } {
  let state = initBuildState(demoCatalog, seed, "home", undefined, formationId);
  const actions: BuildAction[] = [];
  while (!isLineupComplete(state)) {
    const pool = selectablePlayers(demoCatalog, state);
    if (pool.length === 0) throw new Error("dead-end draft in test fixture");
    const best = [...pool].sort((a, b) => {
      const fitA = Math.max(
        ...openSlotsForPlayer(demoCatalog, state, a.id).map((s) =>
          slotFitForPlayer(a, s.position),
        ),
      );
      const fitB = Math.max(
        ...openSlotsForPlayer(demoCatalog, state, b.id).map((s) =>
          slotFitForPlayer(b, s.position),
        ),
      );
      if (fitB !== fitA) return fitB - fitA;
      return a.name.localeCompare(b.name);
    })[0]!;
    const slot = openSlotsForPlayer(demoCatalog, state, best.id).sort(
      (a, b) =>
        slotFitForPlayer(best, b.position) - slotFitForPlayer(best, a.position),
    )[0]!;
    actions.push({ type: "pick", slotId: slot.slotId, playerId: best.id });
    state = selectPlayer(demoCatalog, state, slot.slotId, best.id);
  }
  return { state, actions };
}

describe("replayBuild", () => {
  it("reconstructs the exact state a client built from the same seed", () => {
    const { state, actions } = recordGreedyDraft("duel-seed-1");
    const replayed = replayBuild(demoCatalog, {
      seed: "duel-seed-1",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions,
    });
    expect(replayed.slots).toEqual(state.slots);
    expect(replayed.turnIndex).toBe(state.turnIndex);
    expect(isLineupComplete(replayed)).toBe(true);
  });

  it("is deterministic — two replays of one log are byte-identical", () => {
    const { actions } = recordGreedyDraft("duel-seed-2");
    const a = replayBuild(demoCatalog, {
      seed: "duel-seed-2",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions,
    });
    const b = replayBuild(demoCatalog, {
      seed: "duel-seed-2",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions,
    });
    expect(a).toEqual(b);
  });

  it("rejects a pick of a player not drawn for that turn (anti-cheat)", () => {
    const seed = "duel-seed-3";
    const state = initBuildState(
      demoCatalog,
      seed,
      "home",
      undefined,
      DEFAULT_FORMATION_ID,
    );
    // A player from a scenario other than the one rolled for turn 0.
    const other = demoCatalog.scenarios.find(
      (s) => s.id !== state.currentScenarioId,
    )!;
    const tampered: BuildAction[] = [
      { type: "pick", slotId: "0", playerId: other.playerIds[0]! },
    ];
    expect(() =>
      replayBuild(demoCatalog, {
        seed,
        side: "home",
        formationId: DEFAULT_FORMATION_ID,
        actions: tampered,
      }),
    ).toThrow();
  });
});

describe("replayAndValidate", () => {
  it("accepts a clean full draft", () => {
    const { actions } = recordGreedyDraft("duel-seed-4");
    const out = replayAndValidate(demoCatalog, {
      seed: "duel-seed-4",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions,
      tactic: "balanced",
    });
    expect(out.ok).toBe(true);
  });

  it("accepts a partial (timed-out) draft — incomplete is auto-filled later", () => {
    const { actions } = recordGreedyDraft("duel-seed-5");
    const out = replayAndValidate(demoCatalog, {
      seed: "duel-seed-5",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions: actions.slice(0, 4),
      tactic: "offensive",
    });
    expect(out.ok).toBe(true);
  });

  it("reports a tampered log as a replay_error instead of throwing", () => {
    const out = replayAndValidate(demoCatalog, {
      seed: "duel-seed-6",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions: [{ type: "pick", slotId: "0", playerId: "nonexistent-player" }],
      tactic: "balanced",
    });
    expect(out.ok).toBe(false);
    if (!out.ok) {
      expect(out.errors[0]!.code).toBe("replay_error");
    }
  });
});

describe("resolveDuel", () => {
  it("produces a timeline whose goals reconcile to the score", () => {
    const home = replayBuild(demoCatalog, {
      seed: "match-7:home",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("match-7:home").actions,
    });
    const away = replayBuild(demoCatalog, {
      seed: "match-7:away",
      side: "away",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("match-7:away", DEFAULT_FORMATION_ID).actions,
    });
    const res = resolveDuel(demoCatalog, {
      seed: "match-7",
      home: { buildState: home, tactic: "balanced" },
      away: { buildState: away, tactic: "balanced" },
    });
    const goalEvents = res.timeline.events.filter((e) => e.type === "goal");
    expect(goalEvents.length).toBe(
      res.result.score[0] + res.result.score[1],
    );
    // Knockout duel: never an unresolved draw (penalties decide).
    expect(res.result.winner === "draw" ? res.result.shootout : true).toBeTruthy();
  });

  it("is deterministic for the same seed and builds", () => {
    const mk = (side: "home" | "away") =>
      replayBuild(demoCatalog, {
        seed: `det:${side}`,
        side,
        formationId: DEFAULT_FORMATION_ID,
        actions: recordGreedyDraft(`det:${side}`).actions,
      });
    const args = {
      seed: "det-match",
      home: { buildState: mk("home"), tactic: "balanced" as const },
      away: { buildState: mk("away"), tactic: "balanced" as const },
    };
    const a = resolveDuel(demoCatalog, args);
    const b = resolveDuel(demoCatalog, args);
    expect(a.result.score).toEqual(b.result.score);
    expect(a.timeline.events).toEqual(b.timeline.events);
  });

  it("knockout: false allows an unresolved draw (group-stage fixtures)", () => {
    const home = replayBuild(demoCatalog, {
      seed: "draw:home",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("draw:home").actions,
    });
    const away = replayBuild(demoCatalog, {
      seed: "draw:away",
      side: "away",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("draw:away").actions,
    });
    const res = resolveDuel(demoCatalog, {
      seed: "group-fixture-5",
      home: { buildState: home, tactic: "balanced" },
      away: { buildState: away, tactic: "balanced" },
      knockout: false,
    });
    expect(res.result.score).toEqual([2, 2]);
    expect(res.result.winner).toBe("draw");
    expect(res.result.shootout).toBeUndefined();
  });

  it("auto-fills an incomplete (timed-out) XI before simulating", () => {
    const partial = replayBuild(demoCatalog, {
      seed: "afk:home",
      side: "home",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("afk:home").actions.slice(0, 3),
    });
    const away = replayBuild(demoCatalog, {
      seed: "afk:away",
      side: "away",
      formationId: DEFAULT_FORMATION_ID,
      actions: recordGreedyDraft("afk:away").actions,
    });
    const res = resolveDuel(demoCatalog, {
      seed: "afk-match",
      home: { buildState: partial, tactic: "balanced" },
      away: { buildState: away, tactic: "balanced" },
    });
    expect(isLineupComplete(res.finalStates.home)).toBe(true);
    expect(res.timeline.lineups.home).toHaveLength(11);
  });
});
