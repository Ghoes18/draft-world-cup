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
    teamOveralls: { home: 85, away: 72 },
  };
}

describe("live determinism", () => {
  it("same seed + lineups produce identical snapshots and events", () => {
    const cfg = baseConfig("live-det-1");
    const a = simulateLiveMatch(cfg, { snapshotStride: 10, maxTicks: 200 });
    const b = simulateLiveMatch(cfg, { snapshotStride: 10, maxTicks: 200 });

    expect(a.score).toEqual(b.score);
    expect(a.events.map((e: { type: string }) => e.type)).toEqual(
      b.events.map((e: { type: string }) => e.type),
    );
    expect(a.snapshots.length).toBe(b.snapshots.length);
    for (let i = 0; i < a.snapshots.length; i++) {
      expect(a.snapshots[i]!.ball).toEqual(b.snapshots[i]!.ball);
      expect(a.snapshots[i]!.score).toEqual(b.snapshots[i]!.score);
    }
  });

  it("different seeds diverge", () => {
    const a = simulateLiveMatch(baseConfig("alpha"), { maxTicks: 150 });
    const b = simulateLiveMatch(baseConfig("beta"), { maxTicks: 150 });
    const samePositions =
      a.snapshots[a.snapshots.length - 1]!.ball.x ===
        b.snapshots[b.snapshots.length - 1]!.ball.x &&
      a.snapshots[a.snapshots.length - 1]!.ball.y ===
        b.snapshots[b.snapshots.length - 1]!.ball.y;
    expect(samePositions).toBe(false);
  });
});
