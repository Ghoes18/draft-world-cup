import { describe, expect, it } from "vitest";
import {
  DEFAULT_ELO,
  K_FACTOR,
  applyElo,
  computeTournamentEloChanges,
  expectedScore,
  type ComputeTournamentEloInput,
} from "../src/elo.js";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });

  it("favours the higher-rated side and is symmetric", () => {
    const a = expectedScore(1700, 1500);
    const b = expectedScore(1500, 1700);
    expect(a).toBeGreaterThan(0.5);
    expect(b).toBeLessThan(0.5);
    expect(a + b).toBeCloseTo(1, 10);
  });

  it("is monotonic in the rating gap", () => {
    expect(expectedScore(1600, 1500)).toBeLessThan(expectedScore(1800, 1500));
  });
});

describe("applyElo", () => {
  it("moves an even matchup by ±K/2 on a decisive result", () => {
    const exp = expectedScore(1500, 1500); // 0.5
    expect(applyElo(1500, exp, 1)).toBeCloseTo(1500 + K_FACTOR / 2, 10);
    expect(applyElo(1500, exp, 0)).toBeCloseTo(1500 - K_FACTOR / 2, 10);
  });

  it("does not move on the expected result", () => {
    expect(applyElo(1500, 0.5, 0.5)).toBeCloseTo(1500, 10);
  });
});

/**
 * A minimal 4-slot bracket: two single fixtures so the per-slot deltas are easy
 * to reason about (slots 2 and 3 never play).
 */
function singleFixture(winnerSlot: number | undefined): ComputeTournamentEloInput {
  return {
    participants: [
      { slot: 0, kind: "human", playerId: "a" },
      { slot: 1, kind: "human", playerId: "b" },
    ],
    matches: [
      {
        stage: "group",
        homeSlot: 0,
        awaySlot: 1,
        ...(winnerSlot !== undefined ? { winnerSlot } : {}),
      },
    ],
    startRatings: { 0: 1500, 1: 1500 },
  };
}

describe("computeTournamentEloChanges — single fixture", () => {
  it("is zero-sum between two equal humans on a decisive result", () => {
    const [home, away] = computeTournamentEloChanges(singleFixture(0));
    expect(home!.delta).toBe(+K_FACTOR / 2);
    expect(away!.delta).toBe(-K_FACTOR / 2);
    expect(home!.wins).toBe(1);
    expect(away!.losses).toBe(1);
    expect(home!.played).toBe(1);
  });

  it("credits a draw as 0.5 / 0.5 with no rating change for equals", () => {
    const [home, away] = computeTournamentEloChanges(singleFixture(undefined));
    expect(home!.delta).toBe(0);
    expect(away!.delta).toBe(0);
    expect(home!.draws).toBe(1);
    expect(away!.draws).toBe(1);
  });

  it("defaults an unseeded slot to DEFAULT_ELO", () => {
    const result = computeTournamentEloChanges({
      participants: [
        { slot: 0, kind: "human", playerId: "a" },
        { slot: 1, kind: "cpu" },
      ],
      matches: [{ stage: "group", homeSlot: 0, awaySlot: 1, winnerSlot: 0 }],
      startRatings: { 0: 1500 }, // slot 1 omitted
    });
    expect(result.find((r) => r.slot === 1)!.startRating).toBe(DEFAULT_ELO);
  });
});

/** Full 8-slot World Cup shape: champion path vs a group-eliminated player. */
function fullTournament(): ComputeTournamentEloInput {
  const participants = Array.from({ length: 8 }, (_, slot) => ({
    slot,
    kind: "human" as const,
    playerId: `p${slot}`,
  }));
  const startRatings = Object.fromEntries(participants.map((p) => [p.slot, 1500]));
  // Slot 0 wins everything; slot 3 loses its group games. Groups: 0-3, 4-7.
  const matches: ComputeTournamentEloInput["matches"] = [
    // Group A (slots 0-3)
    { stage: "group", homeSlot: 0, awaySlot: 1, winnerSlot: 0 },
    { stage: "group", homeSlot: 0, awaySlot: 2, winnerSlot: 0 },
    { stage: "group", homeSlot: 0, awaySlot: 3, winnerSlot: 0 },
    { stage: "group", homeSlot: 1, awaySlot: 2, winnerSlot: 1 },
    { stage: "group", homeSlot: 1, awaySlot: 3, winnerSlot: 1 },
    { stage: "group", homeSlot: 2, awaySlot: 3, winnerSlot: 2 },
    // Group B (slots 4-7)
    { stage: "group", homeSlot: 4, awaySlot: 5, winnerSlot: 4 },
    { stage: "group", homeSlot: 4, awaySlot: 6, winnerSlot: 4 },
    { stage: "group", homeSlot: 4, awaySlot: 7, winnerSlot: 4 },
    { stage: "group", homeSlot: 5, awaySlot: 6, winnerSlot: 5 },
    { stage: "group", homeSlot: 5, awaySlot: 7, winnerSlot: 5 },
    { stage: "group", homeSlot: 6, awaySlot: 7, winnerSlot: 6 },
    // Semis + final: slot 0 wins both
    { stage: "semi", homeSlot: 0, awaySlot: 5, winnerSlot: 0 },
    { stage: "semi", homeSlot: 4, awaySlot: 1, winnerSlot: 4 },
    { stage: "final", homeSlot: 0, awaySlot: 4, winnerSlot: 0 },
  ];
  return { participants, matches, startRatings };
}

describe("computeTournamentEloChanges — full tournament", () => {
  it("rewards the champion more than a group-eliminated player", () => {
    const results = computeTournamentEloChanges(fullTournament());
    const champion = results.find((r) => r.slot === 0)!;
    const eliminated = results.find((r) => r.slot === 3)!;
    expect(champion.delta).toBeGreaterThan(0);
    expect(eliminated.delta).toBeLessThan(0);
    expect(champion.delta).toBeGreaterThan(eliminated.delta);
    expect(champion.played).toBe(5); // 3 group + semi + final
    expect(champion.wins).toBe(5);
    expect(eliminated.played).toBe(3);
  });

  it("is deterministic for identical input", () => {
    const a = computeTournamentEloChanges(fullTournament());
    const b = computeTournamentEloChanges(fullTournament());
    expect(a).toEqual(b);
  });
});
