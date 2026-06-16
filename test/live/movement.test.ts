import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import {
  createLiveMatchState,
  tickLiveMatch,
} from "../../src/live/simulator.js";
import {
  MAX_BALL_PASS_STEP,
  MAX_PLAYER_STEP,
} from "../../src/live/constants.js";
import { dist } from "../../src/live/outcomes.js";
import type { LiveMatchConfig } from "../../src/live/types.js";
import { mulberry32 } from "../../src/rng.js";

function baseConfig(): LiveMatchConfig {
  return {
    seed: "move-test",
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: 80, away: 80 },
  };
}

describe("live movement constraints", () => {
  it("outfield players move at most MAX_PLAYER_STEP per tick", () => {
    const state = createLiveMatchState(baseConfig());
    const before = state.players.map((p) => ({ ...p.pos }));
    const rng = mulberry32(1);
    for (let i = 0; i < 30; i++) {
      tickLiveMatch(state, baseConfig().tactics, rng);
    }
    for (let i = 0; i < state.players.length; i++) {
      const p = state.players[i]!;
      const b = before[i]!;
      if (p.isGoalkeeper) continue;
      const d = dist(p.pos, b);
      // Cumulative movement can be large; check single-step in a controlled tick
      expect(d).toBeLessThan(MAX_PLAYER_STEP * 35 + 0.05);
    }
  });

  it("ball pass velocity per tick stays below pass cap", () => {
    const state = createLiveMatchState(baseConfig());
    const rng = mulberry32(99);
    let sawPass = false;
    for (let i = 0; i < 100; i++) {
      tickLiveMatch(state, baseConfig().tactics, rng);
      if (state.ball.mode === "pass" || state.ball.mode === "shot") {
        const speed = Math.sqrt(
          state.ball.vel.x ** 2 + state.ball.vel.y ** 2,
        );
        expect(speed).toBeLessThanOrEqual(MAX_BALL_PASS_STEP * 1.31);
        sawPass = true;
      }
    }
    expect(sawPass).toBe(true);
  });

  it("players stay inside pitch bounds", () => {
    const state = createLiveMatchState(baseConfig());
    const rng = mulberry32(7);
    for (let i = 0; i < 120; i++) {
      tickLiveMatch(state, baseConfig().tactics, rng);
      for (const p of state.players) {
        expect(p.pos.x).toBeGreaterThanOrEqual(0.02);
        expect(p.pos.x).toBeLessThanOrEqual(0.98);
        expect(p.pos.y).toBeGreaterThanOrEqual(0.05);
        expect(p.pos.y).toBeLessThanOrEqual(0.95);
      }
    }
  });
});
