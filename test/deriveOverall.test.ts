import { describe, expect, it } from "vitest";
import {
  careerMeritScore,
  deriveOverall,
  derivePlayerOverall,
  inferInternationalReputation,
  internationalReputationBoost,
  isFinalStage,
  isKnockoutStage,
  meritsToOveralls,
} from "../src/catalog/deriveOverall.js";
import { hashSeed } from "../src/rng.js";

describe("deriveOverall stages", () => {
  it("detects knockout and final stages", () => {
    expect(isKnockoutStage("quarter-finals")).toBe(true);
    expect(isKnockoutStage("final")).toBe(true);
    expect(isFinalStage("final")).toBe(true);
    expect(isKnockoutStage("group stage")).toBe(false);
  });
});

describe("careerMeritScore", () => {
  it("ranks cup-winning star above bench player", () => {
    const star = careerMeritScore({
      starts: 6,
      subs: 0,
      goals: 4,
      knockoutGoals: 2,
      finalGoals: 1,
      teamWonCup: true,
      teamReachedFinal: true,
      worldCupsPlayed: 3,
    });
    const bench = careerMeritScore({
      starts: 0,
      subs: 2,
      goals: 0,
      knockoutGoals: 0,
      finalGoals: 0,
      teamWonCup: false,
      teamReachedFinal: false,
      worldCupsPlayed: 1,
    });
    expect(star).toBeGreaterThan(bench);
  });

  it("is deterministic", () => {
    const input = {
      starts: 5,
      subs: 1,
      goals: 2,
      knockoutGoals: 1,
      finalGoals: 0,
      teamWonCup: false,
      teamReachedFinal: true,
      worldCupsPlayed: 2,
    };
    expect(careerMeritScore(input)).toBe(careerMeritScore(input));
  });
});

describe("meritsToOveralls", () => {
  it("rates careers on an absolute (squad-independent) scale", () => {
    const merits = new Map([
      ["star", 120],
      ["bench", 5],
    ]);
    const overalls = meritsToOveralls(merits, (k) => k, (s) => hashSeed(s));
    expect(overalls.get("star")!).toBeGreaterThan(overalls.get("bench")!);
    expect(overalls.get("star")!).toBeGreaterThanOrEqual(85);
    expect(overalls.get("star")!).toBeLessThanOrEqual(93);
    expect(overalls.get("bench")!).toBeLessThanOrEqual(72);
  });

  it("does not push a weak squad's best player to the ceiling", () => {
    // Three group-stage starters with identical, modest merit (Australia 1974).
    const merits = new Map([
      ["a", 12],
      ["b", 12],
      ["c", 12],
    ]);
    const overalls = meritsToOveralls(merits, (k) => k, (s) => hashSeed(s));
    for (const v of overalls.values()) {
      expect(v).toBeLessThanOrEqual(76);
    }
  });

  it("clamps to 0–100", () => {
    const merits = new Map([["a", 999]]);
    const overalls = meritsToOveralls(merits, (k) => k, () => 0);
    expect(overalls.get("a")!).toBeLessThanOrEqual(100);
    expect(overalls.get("a")!).toBeGreaterThanOrEqual(0);
  });
});

describe("deriveOverall", () => {
  it("returns bench band when merit is zero without squad range", () => {
    const ovr = deriveOverall({
      starts: 0,
      subs: 0,
      goals: 0,
      knockoutGoals: 0,
      finalGoals: 0,
      teamWonCup: false,
      teamReachedFinal: false,
      worldCupsPlayed: 1,
    });
    expect(ovr).toBeGreaterThanOrEqual(62);
    expect(ovr).toBeLessThanOrEqual(75);
  });
});

describe("internationalReputationBoost", () => {
  it("matches FIFA-style tables for 4★ and 5★", () => {
    expect(internationalReputationBoost(71, 4)).toBe(2);
    expect(internationalReputationBoost(78, 5)).toBe(3);
    expect(internationalReputationBoost(40, 2)).toBe(0);
  });
});

describe("derivePlayerOverall", () => {
  it("raises iconic attackers with a weak WC edition (Figo 2002 pattern)", () => {
    const edition = {
      starts: 3,
      subs: 0,
      goals: 0,
      knockoutGoals: 0,
      finalGoals: 0,
      teamWonCup: false,
      teamReachedFinal: false,
      worldCupsPlayed: 1,
    };
    const ovr = derivePlayerOverall({
      edition,
      career: edition,
      pedigree: {
        worldCupsPlayed: 1,
        careerStarts: 3,
        careerGoals: 0,
        careerKnockoutGoals: 0,
        everWonCup: false,
        everReachedFinal: false,
        everReachedSemiOrBetter: false,
        editionStarts: 3,
        coarsePosition: "MF",
        shirtNumber: 7,
      },
    });
    expect(ovr).toBeGreaterThanOrEqual(78);
    expect(ovr).toBeLessThanOrEqual(93);
  });

  it("does not floor weak squad regulars without reputation", () => {
    const edition = {
      starts: 3,
      subs: 0,
      goals: 0,
      knockoutGoals: 0,
      finalGoals: 0,
      teamWonCup: false,
      teamReachedFinal: false,
      worldCupsPlayed: 1,
    };
    const ovr = derivePlayerOverall({
      edition,
      career: edition,
      pedigree: {
        worldCupsPlayed: 1,
        careerStarts: 3,
        careerGoals: 0,
        careerKnockoutGoals: 0,
        everWonCup: false,
        everReachedFinal: false,
        everReachedSemiOrBetter: false,
        editionStarts: 3,
        coarsePosition: "DF",
        shirtNumber: 4,
      },
    });
    expect(ovr).toBeLessThanOrEqual(78);
  });
});

describe("inferInternationalReputation", () => {
  it("gives 4★ to iconic shirt + full group run attackers", () => {
    expect(
      inferInternationalReputation({
        worldCupsPlayed: 1,
        careerStarts: 3,
        careerGoals: 0,
        careerKnockoutGoals: 0,
        everWonCup: false,
        everReachedFinal: false,
        everReachedSemiOrBetter: false,
        editionStarts: 3,
        coarsePosition: "MF",
        shirtNumber: 7,
      }),
    ).toBe(4);
  });
});
