import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import {
  createLiveMatchState,
  simulateLiveMatch,
  tickLiveMatch,
} from "../../src/live/simulator.js";
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

describe("live loose ball", () => {
  it("failed pass becomes loose ball instead of instant dead restart", () => {
    const state = createLiveMatchState(baseConfig("loose-pass"));
    state.ball.mode = "pass";
    state.ball.ownerId = state.players.find((p) => p.side === "home" && !p.isGoalkeeper)!.id;
    state.ball.targetId = state.players.find((p) => p.side === "home" && p.position === "ST")!.id;
    state.ball.pos = { x: 0.5, y: 0.5 };
    state.ball.vel = { x: 0.02, y: 0 };
    state.possession = "home";

    // Seed chosen so an incomplete pass lands inside the window; the invariant
    // under test is "incomplete pass → loose ball, never an instant dead restart".
    const rng = rngFromSeed("loose-pass:force2");
    let sawLoose = false;
    for (let i = 0; i < 80; i++) {
      tickLiveMatch(state, { home: "balanced", away: "balanced" }, rng);
      if (state.events.some((e) => e.detail === "incomplete pass")) {
        expect(state.ball.mode).toBe("loose");
        sawLoose = true;
        break;
      }
    }
    expect(sawLoose).toBe(true);
  });

  it("loose ball is collected by a player within bounded ticks", () => {
    const state = createLiveMatchState(baseConfig("loose-collect"));
    state.ball.mode = "loose";
    state.ball.ownerId = null;
    state.ball.pos = { x: 0.55, y: 0.5 };
    state.ball.vel = { x: 0, y: 0 };
    const carrier = state.players.find((p) => p.side === "home" && p.position === "CM")!;
    carrier.pos = { x: 0.54, y: 0.5 };

    const rng = rngFromSeed("loose-collect:rng");
    let collected = false;
    for (let i = 0; i < 30; i++) {
      tickLiveMatch(state, { home: "balanced", away: "balanced" }, rng);
      if (state.ball.ownerId !== null) {
        collected = true;
        break;
      }
    }
    expect(collected).toBe(true);
  });

  it("full match does not teleport CM to anchor on incomplete passes", () => {
    const result = simulateLiveMatch(baseConfig("loose-full"), { snapshotStride: 5 });
    const restarts = result.events.filter((e) => e.detail === "restart");
    expect(restarts.length).toBe(0);
    const incomplete = result.events.filter((e) => e.detail === "incomplete pass");
    for (const ev of incomplete) {
      const snap = result.snapshots.find((s) => s.tick >= ev.tick && s.tick <= ev.tick + 5);
      expect(snap?.ballMode).not.toBe("dead");
    }
  });
});
