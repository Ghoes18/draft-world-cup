import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { simulateLiveMatch } from "../../src/live/simulator.js";
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

describe("live ball restarts", () => {
  it("never finishes a full match with a permanently dead ball", () => {
    const seeds = ["ugly-1", "demo-seed", "alpha", "beta", "restart-a", "restart-b"];
    for (const seed of seeds) {
      const result = simulateLiveMatch(baseConfig(seed), { snapshotStride: 30 });
      expect(result.finalState.ball.mode).not.toBe("dead");
      expect(result.finalState.ball.ownerId).not.toBeNull();
    }
  });

  it("recovers from dead ball within a short window", () => {
    const result = simulateLiveMatch(baseConfig("ugly-1"), {
      snapshotStride: 1,
      maxTicks: 200,
    });
    const deadSnapshots = result.snapshots.filter(
      (s) => s.players.every((p) => !p.hasBall) && result.finalState.ball.mode === "dead",
    );
    expect(deadSnapshots.length).toBeLessThan(result.snapshots.length);
    const last = result.snapshots[result.snapshots.length - 1]!;
    const someoneHasBall = last.players.some((p) => p.hasBall);
    expect(someoneHasBall || result.finalState.ball.mode !== "dead").toBe(true);
  });
});
