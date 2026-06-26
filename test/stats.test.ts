import { describe, expect, it } from "vitest";
import { simulateMatch, type TeamStrength } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import { computeMatchStats } from "../src/consumers/stats.js";
import type { MatchTimeline } from "../src/types.js";

const STRONG: TeamStrength = { attack: 91, midfield: 91, defense: 91, overall: 91 };
const WEAK: TeamStrength = { attack: 68, midfield: 68, defense: 68, overall: 68 };

function build(seed: string, knockout = false): MatchTimeline {
  const result = simulateMatch({ home: STRONG, away: WEAK, seed, knockout });
  return generateTimeline({
    result,
    seed,
    scenario: { team: "Test", cup: 1970 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });
}

describe("computeMatchStats", () => {
  it("is deterministic and pure (depends only on the timeline)", () => {
    const tl = build("stats-seed");
    expect(computeMatchStats(tl)).toEqual(computeMatchStats(tl));
    expect(computeMatchStats(build("stats-seed"))).toEqual(
      computeMatchStats(build("stats-seed")),
    );
  });

  it("possession percentages sum to 100", () => {
    for (let i = 0; i < 50; i++) {
      const s = computeMatchStats(build(`poss${i}`));
      expect(s.home.possession + s.away.possession).toBe(100);
    }
  });

  it("never reports fewer shots than goals, and on-target within bounds", () => {
    for (let i = 0; i < 100; i++) {
      const tl = build(`bounds${i}`);
      const s = computeMatchStats(tl);
      const [homeGoals, awayGoals] = tl.result.score;
      expect(s.home.shots).toBeGreaterThanOrEqual(homeGoals);
      expect(s.away.shots).toBeGreaterThanOrEqual(awayGoals);
      expect(s.home.shotsOnTarget).toBeGreaterThanOrEqual(homeGoals);
      expect(s.away.shotsOnTarget).toBeGreaterThanOrEqual(awayGoals);
      expect(s.home.shotsOnTarget).toBeLessThanOrEqual(s.home.shots);
      expect(s.away.shotsOnTarget).toBeLessThanOrEqual(s.away.shots);
    }
  });

  it("xG is non-negative", () => {
    for (let i = 0; i < 50; i++) {
      const s = computeMatchStats(build(`xg${i}`));
      expect(s.home.xg).toBeGreaterThanOrEqual(0);
      expect(s.away.xg).toBeGreaterThanOrEqual(0);
    }
  });

  it("penalties are a subset of goals (penalty-goals only)", () => {
    for (let i = 0; i < 100; i++) {
      const tl = build(`pen${i}`);
      const s = computeMatchStats(tl);
      expect(s.home.penalties).toBeLessThanOrEqual(tl.result.score[0]);
      expect(s.away.penalties).toBeLessThanOrEqual(tl.result.score[1]);
    }
  });

  it("occasionally dramatises a goal as a penalty", () => {
    let sawPenalty = false;
    for (let i = 0; i < 300 && !sawPenalty; i++) {
      const s = computeMatchStats(build(`anypen${i}`));
      if (s.home.penalties + s.away.penalties > 0) sawPenalty = true;
    }
    expect(sawPenalty).toBe(true);
  });
});
