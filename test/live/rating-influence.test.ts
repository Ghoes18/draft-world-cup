import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import { simulateLiveMatch } from "../../src/live/simulator.js";
import type { LiveMatchConfig } from "../../src/live/types.js";

function runMany(home: number, away: number, count: number): {
  homeWins: number;
  awayWins: number;
  draws: number;
  totalGoals: number;
} {
  let homeWins = 0;
  let awayWins = 0;
  let draws = 0;
  let totalGoals = 0;
  for (let i = 0; i < count; i++) {
    const cfg: LiveMatchConfig = {
      seed: `rating-${home}-${away}-${i}`,
      lineups: {
        home: defaultLineup("home"),
        away: defaultLineup("away"),
      },
      tactics: { home: "balanced", away: "balanced" },
      teamOveralls: { home, away },
    };
    const r = simulateLiveMatch(cfg, { snapshotStride: 50 });
    totalGoals += r.score[0] + r.score[1];
    if (r.score[0] > r.score[1]) homeWins++;
    else if (r.score[1] > r.score[0]) awayWins++;
    else draws++;
  }
  return { homeWins, awayWins, draws, totalGoals };
}

describe("team rating influence on live matches", () => {
  it("stronger team wins more often over many runs", () => {
    const strong = runMany(92, 68, 40);
    expect(strong.homeWins).toBeGreaterThan(strong.awayWins);
  });

  it("produces goals and varied events across runs", () => {
    const sample = runMany(85, 75, 20);
    expect(sample.totalGoals).toBeGreaterThan(0);
    expect(sample.homeWins + sample.awayWins + sample.draws).toBe(20);
  });
});
