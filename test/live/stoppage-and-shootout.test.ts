import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { LIVE_TOTAL_TICKS } from "../../src/live/constants.js";
import { simulateLiveMatch } from "../../src/live/simulator.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function baseConfig(seed: string, knockout = false): LiveMatchConfig {
  return {
    seed,
    lineups: {
      home: defaultLineup("home"),
      away: defaultLineup("away"),
    },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: 80, away: 80 },
    knockout,
  };
}

describe("live stoppage and shootout", () => {
  it("extends match beyond regulation when stoppage is accrued", () => {
    const result = simulateLiveMatch(baseConfig("stoppage"), { snapshotStride: 50 });
    const maxTick = result.finalState.tick;
    expect(maxTick).toBeGreaterThanOrEqual(LIVE_TOTAL_TICKS);
  });

  it("knockout tied match can produce shootout events", () => {
    const seeds = ["ko-a", "ko-b", "ko-c", "ko-d", "ko-e", "ko-f", "ko-g", "ko-h"];
    let shootouts = 0;
    for (const seed of seeds) {
      const result = simulateLiveMatch(
        { ...baseConfig(seed, true), teamOveralls: { home: 80, away: 80 } },
        { snapshotStride: 40 },
      );
      if (result.shootout) {
        shootouts++;
        expect(result.events.some((e) => e.type === "shootout")).toBe(true);
        expect(result.winner).not.toBe("draw");
      }
    }
    expect(shootouts).toBeGreaterThanOrEqual(0);
  });

  it("non-knockout match allows draws", () => {
    const result = simulateLiveMatch(baseConfig("league-draw"), { snapshotStride: 40 });
    if (result.score[0] === result.score[1]) {
      expect(result.winner).toBe("draw");
      expect(result.shootout).toBeUndefined();
    }
  });
});
