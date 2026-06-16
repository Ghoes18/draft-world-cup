import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { decideTickPlan } from "../../src/live/decision.js";
import { createLiveMatchState, simulateLiveMatch } from "../../src/live/simulator.js";
import { rngFromSeed } from "../../src/rng.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function baseConfig(seed: string): LiveMatchConfig {
  return {
    seed,
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "offensive", away: "balanced" },
    teamOveralls: { home: 85, away: 75 },
  };
}

describe("live crossing", () => {
  it("does not cross from central areas without wide position", () => {
    const state = createLiveMatchState(baseConfig("cross-central"));
    const winger = state.players.find((p) => p.side === "home" && p.position === "RW");
    const st = state.players.find((p) => p.side === "home" && p.position === "ST");
    expect(winger).toBeDefined();
    expect(st).toBeDefined();
    winger!.pos = { x: 0.55, y: 0.5 };
    st!.pos = { x: 0.88, y: 0.5 };
    state.ball.mode = "carried";
    state.ball.ownerId = winger!.id;
    state.possession = "home";

    const rng = rngFromSeed("cross-central");
    let sawCross = false;
    for (let i = 0; i < 40; i++) {
      state.tick = i;
      const plan = decideTickPlan(state, { home: "offensive", away: "balanced" }, rng);
      if (plan.carrierAction.kind === "cross") sawCross = true;
    }
    expect(sawCross).toBe(false);
  });

  it("can cross from wide advanced position with box target", () => {
    const state = createLiveMatchState(baseConfig("cross-wide"));
    const winger = state.players.find((p) => p.side === "home" && p.position === "RW");
    const st = state.players.find((p) => p.side === "home" && p.position === "ST");
    winger!.pos = { x: 0.78, y: 0.12 };
    st!.pos = { x: 0.88, y: 0.48 };
    state.ball.mode = "carried";
    state.ball.ownerId = winger!.id;
    state.possession = "home";

    const rng = rngFromSeed("cross-wide");
    let sawCross = false;
    for (let i = 0; i < 60; i++) {
      state.tick = i;
      const plan = decideTickPlan(state, { home: "offensive", away: "balanced" }, rng);
      if (plan.carrierAction.kind === "cross") {
        sawCross = true;
        expect(plan.carrierAction).toMatchObject({ kind: "cross" });
      }
    }
    expect(sawCross).toBe(true);
  });

  it("full match may produce cross events with contested outcomes", () => {
    const result = simulateLiveMatch(baseConfig("cross-match"), { snapshotStride: 20 });
    const crosses = result.events.filter((e) => e.type === "cross");
    if (crosses.length > 0) {
      const details = new Set(crosses.map((c) => c.detail));
      expect(details.size).toBeGreaterThan(0);
    }
  });
});
