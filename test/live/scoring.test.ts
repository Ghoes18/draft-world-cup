import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { simulateLiveMatch } from "../../src/live/simulator.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function config(seed: string, home: number, away: number): LiveMatchConfig {
  return {
    seed,
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home, away },
  };
}

/**
 * Guards the scoring calibration: the live sim used to end ~0-0 almost every
 * match (a 91% keeper save rate plus a redundant goal gate). These bounds are
 * deliberately wide so they lock in "matches actually produce goals at a
 * believable rate" without being brittle to fine tuning.
 */
describe("live scoring calibration", () => {
  it("produces a believable goal and save rate for even sides", () => {
    const N = 80;
    let goals = 0;
    let saves = 0;
    let goalless = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateLiveMatch(config(`score-${i}`, 80, 80), { snapshotStride: 30 });
      const total = r.score[0] + r.score[1];
      goals += total;
      saves += r.events.filter((e) => e.type === "save").length;
      if (total === 0) goalless++;
    }
    const perMatch = goals / N;
    const onTarget = saves + goals;
    const saveRate = saves / onTarget;

    // Well above the old ~0.15/match, and not absurdly high.
    expect(perMatch).toBeGreaterThan(0.6);
    expect(perMatch).toBeLessThan(4);
    // Realistic keeper save band (was a broken ~0.91).
    expect(saveRate).toBeGreaterThan(0.5);
    expect(saveRate).toBeLessThan(0.85);
    // Most matches should NOT be goalless anymore.
    expect(goalless / N).toBeLessThan(0.5);
  });

  it("lets the stronger side score more over many matches", () => {
    const N = 60;
    let strongGoals = 0;
    let weakGoals = 0;
    for (let i = 0; i < N; i++) {
      const r = simulateLiveMatch(config(`gap-${i}`, 88, 70), { snapshotStride: 30 });
      strongGoals += r.score[0];
      weakGoals += r.score[1];
    }
    expect(strongGoals).toBeGreaterThan(weakGoals * 2);
  });
});
