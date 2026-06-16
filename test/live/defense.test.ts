import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { createLiveMatchState, tickLiveMatch } from "../../src/live/simulator.js";
import { decideTickPlan } from "../../src/live/decision.js";
import { mulberry32 } from "../../src/rng.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function baseConfig(): LiveMatchConfig {
  return {
    seed: "defense-test",
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: 80, away: 80 },
  };
}

describe("defensive AI shape", () => {
  it("assigns distinct intents to multiple defenders", () => {
    const state = createLiveMatchState(baseConfig());
    const rng = mulberry32(11);
    const intentsSeen = new Set<string>();
    for (let i = 0; i < 40; i++) {
      tickLiveMatch(state, baseConfig().tactics, rng);
      const plan = decideTickPlan(state, baseConfig().tactics, mulberry32(i));
      for (const [id, intent] of plan.intents) {
        const p = state.players.find((pl) => pl.id === id);
        if (p && p.side === "away" && !p.isGoalkeeper) {
          intentsSeen.add(intent.kind);
        }
      }
    }
    expect(intentsSeen.has("holdShape") || intentsSeen.has("mark")).toBe(true);
    expect(intentsSeen.has("press") || intentsSeen.has("blockLane")).toBe(true);
  });
});
