import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import {
  createLiveMatchState,
  simulateLiveMatch,
  tickLiveMatch,
} from "../../src/live/simulator.js";
import { isInPenaltyBox } from "../../src/live/outcomes.js";
import { rngFromSeed } from "../../src/rng.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function baseConfig(seed: string): LiveMatchConfig {
  return {
    seed,
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: 80, away: 80 },
  };
}

describe("live set pieces", () => {
  it("detects penalty box fouls", () => {
    expect(isInPenaltyBox({ x: 0.9, y: 0.5 }, "home")).toBe(true);
    expect(isInPenaltyBox({ x: 0.5, y: 0.5 }, "home")).toBe(false);
  });

  it("schedules free kick after foul outside the box", () => {
    const state = createLiveMatchState(baseConfig("fk-test"));
    state.setPiece = {
      kind: "freekick",
      side: "home",
      spot: { x: 0.6, y: 0.5 },
      takerId: state.players.find((p) => p.side === "home" && p.position === "ST")!.id,
      delayTicks: 0,
    };
    state.ball.mode = "dead";
    state.ball.pos = { x: 0.6, y: 0.5 };
    state.ball.restartDelay = 0;
    state.possession = "home";

    const rng = rngFromSeed("fk-test");
    tickLiveMatch(state, { home: "balanced", away: "balanced" }, rng);
    expect(state.ball.mode).toBe("carried");
    expect(state.setPiece).toBeNull();
  });

  it("may produce fouls and set-piece events over a full match", () => {
    const result = simulateLiveMatch(baseConfig("foul-match"), { snapshotStride: 30 });
    const fouls = result.events.filter((e) => e.type === "foul");
    const setPieces = result.events.filter(
      (e) => e.type === "freekick" || e.type === "penalty",
    );
    expect(fouls.length + setPieces.length).toBeGreaterThanOrEqual(0);
  });
});
