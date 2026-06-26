import { describe, expect, it } from "vitest";
import {
  expectedGoals,
  penaltyWin,
  simulateMatch,
  simulateShootout,
  type TeamStrength,
} from "../src/engine.js";
import { mulberry32 } from "../src/rng.js";

const STRONG: TeamStrength = { attack: 91, midfield: 91, defense: 91, overall: 91 };
const WEAK: TeamStrength = { attack: 68, midfield: 68, defense: 68, overall: 68 };

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

  it("adds 0.04 per point of midfield edge", () => {
    expect(expectedGoals(80, 80, 90, 80)).toBeCloseTo(1.4 + 10 * 0.04, 10);
  });

  it("is unchanged when midfields are equal (live-game parity)", () => {
    expect(expectedGoals(85, 80, 75, 75)).toBeCloseTo(expectedGoals(85, 80), 10);
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

describe("extra time (knockout)", () => {
  const EVEN: TeamStrength = { attack: 80, midfield: 80, defense: 80, overall: 80 };

  it("regulation equals the final score and no ET for non-knockout matches", () => {
    for (let i = 0; i < 100; i++) {
      const r = simulateMatch({ home: STRONG, away: WEAK, seed: `reg${i}` });
      expect(r.regulation).toEqual(r.score);
      expect(r.extraTime).toBeFalsy();
    }
  });

  it("plays extra time iff a knockout tie is level at 90', and only then can reach penalties", () => {
    let sawET = false;
    let sawShootout = false;
    for (let i = 0; i < 300; i++) {
      const r = simulateMatch({ home: EVEN, away: EVEN, seed: `et${i}`, knockout: true });
      const drawnAt90 = r.regulation[0] === r.regulation[1];
      expect(r.extraTime ?? false).toBe(drawnAt90);
      if (drawnAt90) {
        sawET = true;
        // ET only adds goals — never removes them.
        expect(r.score[0]).toBeGreaterThanOrEqual(r.regulation[0]);
        expect(r.score[1]).toBeGreaterThanOrEqual(r.regulation[1]);
        // A shootout happens exactly when ET is still level.
        expect(Boolean(r.shootout)).toBe(r.score[0] === r.score[1]);
        if (r.shootout) sawShootout = true;
      } else {
        expect(r.regulation).toEqual(r.score);
        expect(r.shootout).toBeUndefined();
      }
      expect(r.winner).not.toBe("draw");
    }
    expect(sawET).toBe(true);
    expect(sawShootout).toBe(true);
  });

  it("never plays extra time when regulation is already decisive", () => {
    let sawDecisive = false;
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch({ home: STRONG, away: WEAK, seed: `dec${i}`, knockout: true });
      if (r.regulation[0] !== r.regulation[1]) {
        sawDecisive = true;
        expect(r.extraTime).toBeFalsy();
        expect(r.regulation).toEqual(r.score);
      }
    }
    expect(sawDecisive).toBe(true);
  });

  it("is deterministic through extra time and penalties", () => {
    const a = simulateMatch({ home: EVEN, away: EVEN, seed: "et-dup", knockout: true });
    const b = simulateMatch({ home: EVEN, away: EVEN, seed: "et-dup", knockout: true });
    expect(a).toEqual(b);
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
