import { describe, expect, it } from "vitest";
import {
  expectedGoals,
  penaltyWin,
  simulateMatch,
  simulateShootout,
  type TeamStrength,
} from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";

const STRONG: TeamStrength = { attack: 91, defense: 91, overall: 91 };
const WEAK: TeamStrength = { attack: 68, defense: 68, overall: 68 };

describe("expectedGoals", () => {
  it("equals base lambda for evenly matched teams", () => {
    expect(expectedGoals(80, 80)).toBeCloseTo(1.4, 10);
  });

  it("adds 0.08 per point of advantage", () => {
    expect(expectedGoals(85, 80)).toBeCloseTo(1.4 + 5 * 0.08, 10);
  });

  it("clamps to [0.15, 5]", () => {
    expect(expectedGoals(0, 200)).toBe(0.15); // huge negative gap
    expect(expectedGoals(200, 0)).toBe(5); // huge positive gap
  });
});

describe("penaltyWin", () => {
  it("is a coin flip for even teams", () => {
    expect(penaltyWin(0)).toBeCloseTo(0.5, 10);
  });

  it("clamps to [0.1, 0.9]", () => {
    expect(penaltyWin(1000)).toBe(0.9);
    expect(penaltyWin(-1000)).toBe(0.1);
  });
});

describe("simulateMatch", () => {
  it("is deterministic for a given seed", () => {
    const a = simulateMatch({ home: STRONG, away: WEAK, seed: "abc" });
    const b = simulateMatch({ home: STRONG, away: WEAK, seed: "abc" });
    expect(a).toEqual(b);
  });

  it("produces different results for different seeds (sanity)", () => {
    const scores = new Set<string>();
    for (let i = 0; i < 50; i++) {
      const r = simulateMatch({ home: STRONG, away: WEAK, seed: `s${i}` });
      scores.add(r.score.join("-"));
    }
    expect(scores.size).toBeGreaterThan(1);
  });

  it("never resolves a knockout as a draw", () => {
    // Even, knockout matches will draw often; every draw must go to penalties.
    let sawShootout = false;
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch({
        home: WEAK,
        away: WEAK,
        seed: `ko${i}`,
        knockout: true,
      });
      expect(r.winner).not.toBe("draw");
      if (r.score[0] === r.score[1]) {
        expect(r.shootout).toBeDefined();
        expect(r.penalties).toBeDefined();
        sawShootout = true;
      }
    }
    expect(sawShootout).toBe(true);
  });

  it("does not run a shootout in non-knockout draws", () => {
    let sawDraw = false;
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch({ home: WEAK, away: WEAK, seed: `lg${i}` });
      if (r.score[0] === r.score[1]) {
        expect(r.winner).toBe("draw");
        expect(r.shootout).toBeUndefined();
        sawDraw = true;
      }
    }
    expect(sawDraw).toBe(true);
  });
});

describe("simulateShootout", () => {
  it("declares the side with more makes as the winner", () => {
    for (let i = 0; i < 100; i++) {
      const s = simulateShootout(STRONG, WEAK, mulberry32(i));
      const [home, away] = s.tally;
      expect(home).not.toBe(away);
      expect(s.winner).toBe(home > away ? "home" : "away");
      const made = s.kicks.filter((k) => k.scored);
      expect(made.filter((k) => k.team === "home").length).toBe(home);
      expect(made.filter((k) => k.team === "away").length).toBe(away);
    }
  });
});
