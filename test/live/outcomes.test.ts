import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { simulateLiveMatch } from "../../src/live/simulator.js";
import type { LiveMatchConfig, LiveMatchEvent } from "../../src/live/types.js";

function baseConfig(seed: string): LiveMatchConfig {
  return {
    seed,
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "offensive", away: "defensive" },
    teamOveralls: { home: 88, away: 70 },
  };
}

describe("live match outcomes", () => {
  it("produces pass, tackle, shot, or turnover events over a short run", () => {
    const result = simulateLiveMatch(baseConfig("outcomes-1"), {
      maxTicks: 300,
      snapshotStride: 5,
    });
    const types = new Set(result.events.map((e: LiveMatchEvent) => e.type));
    expect(types.has("kickoff")).toBe(true);
    const actionTypes: LiveMatchEvent["type"][] = ["pass", "dribble", "tackle", "shot", "turnover", "save", "goal"];
    const hasAction = actionTypes.some((t) => types.has(t));
    expect(hasAction).toBe(true);
  });

  it("finishes a full match at 90 minutes", () => {
    const result = simulateLiveMatch(baseConfig("full-match"), {
      snapshotStride: 30,
    });
    expect(result.finalState.finished).toBe(true);
    expect(result.finalState.minute).toBeGreaterThanOrEqual(90);
    expect(result.events.some((e: LiveMatchEvent) => e.type === "fulltime")).toBe(true);
  });

  it("snapshots reconcile score with final state", () => {
    const result = simulateLiveMatch(baseConfig("score-sync"), {
      maxTicks: 250,
      snapshotStride: 1,
    });
    const last = result.snapshots[result.snapshots.length - 1]!;
    expect(last.score).toEqual(result.score);
  });
});
