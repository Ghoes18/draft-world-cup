import { describe, expect, it } from "vitest";
import { mulberry32 } from "../../src/rng.js";
import { derivePlayerAttributes } from "../../src/live/attributes.js";
import { defaultLineup } from "../../src/lineup.js";
import {
  passSuccessChance,
  rollPassSuccess,
  saveChance,
  shotGoalChance,
  tackleSuccessChance,
} from "../../src/live/outcomes.js";
import type { LivePlayer } from "../../src/live/types.js";
import type { LineupSlot } from "../../src/types.js";

function mkPlayer(
  id: string,
  side: "home" | "away",
  overall: number,
  pos = { x: 0.5, y: 0.5 },
): LivePlayer {
  const slot = defaultLineup(side).find((s: LineupSlot) => s.playerId === id)!;
  return {
    id,
    side,
    number: slot.number,
    position: slot.position,
    anchor: slot.anchor,
    pos,
    vel: { x: 0, y: 0 },
    attrs: derivePlayerAttributes(slot, side, overall),
    stamina: 1,
    isGoalkeeper: slot.position === "GK",
  };
}

describe("rating-weighted outcomes", () => {
  it("high-rated passers complete more passes than low-rated over many rolls", () => {
    const elite = mkPlayer("home-7", "home", 94, { x: 0.5, y: 0.5 });
    const weak = mkPlayer("home-7", "home", 62, { x: 0.5, y: 0.5 });
    const receiver = mkPlayer("home-10", "home", 80, { x: 0.62, y: 0.48 });
    const defenders: LivePlayer[] = [
      mkPlayer("away-4", "away", 75, { x: 0.58, y: 0.52 }),
    ];

    const eliteChance = passSuccessChance({
      passer: elite,
      receiver,
      defenders,
      throughBall: false,
      teamOverall: 88,
      oppTeamOverall: 75,
    });
    const weakChance = passSuccessChance({
      passer: weak,
      receiver,
      defenders,
      throughBall: false,
      teamOverall: 68,
      oppTeamOverall: 75,
    });
    expect(eliteChance).toBeGreaterThan(weakChance);

    const rng = mulberry32(42);
    let eliteOk = 0;
    let weakOk = 0;
    const trials = 500;
    for (let i = 0; i < trials; i++) {
      if (rollPassSuccess(rng, eliteChance)) eliteOk++;
      if (rollPassSuccess(rng, weakChance)) weakOk++;
    }
    expect(eliteOk).toBeGreaterThan(weakOk);
  });

  it("strong keepers save more than weak keepers", () => {
    const shooter = mkPlayer("home-10", "home", 82, { x: 0.82, y: 0.5 });
    const eliteGk = mkPlayer("away-1", "away", 92, { x: 0.05, y: 0.5 });
    const weakGk = mkPlayer("away-1", "away", 60, { x: 0.05, y: 0.5 });
    const ctx = {
      shooter,
      distanceToGoal: 0.18,
      angleQuality: 0.8,
      pressure: 0.1,
      teamOverall: 82,
      oppTeamOverall: 80,
    };
    const eliteSave = saveChance({ ...ctx, keeper: eliteGk });
    const weakSave = saveChance({ ...ctx, keeper: weakGk });
    expect(eliteSave).toBeGreaterThan(weakSave);
  });

  it("better defenders win more tackles", () => {
    const eliteDef = mkPlayer("away-4", "away", 90, { x: 0.55, y: 0.5 });
    const weakDef = mkPlayer("away-4", "away", 62, { x: 0.55, y: 0.5 });
    const dribbler = mkPlayer("home-11", "home", 80, { x: 0.56, y: 0.5 });
    const eliteChance = tackleSuccessChance({
      defender: eliteDef,
      attacker: dribbler,
      distance: 0.03,
      teamOverall: 85,
      oppTeamOverall: 80,
    });
    const weakChance = tackleSuccessChance({
      defender: weakDef,
      attacker: dribbler,
      distance: 0.03,
      teamOverall: 68,
      oppTeamOverall: 80,
    });
    expect(eliteChance).toBeGreaterThan(weakChance);
  });

  it("better shooters score more often from same position", () => {
    const elite = mkPlayer("home-10", "home", 93, { x: 0.72, y: 0.42 });
    const weak = mkPlayer("home-10", "home", 65, { x: 0.72, y: 0.42 });
    const gk = mkPlayer("away-1", "away", 80, { x: 0.05, y: 0.5 });
    const base = {
      keeper: gk,
      distanceToGoal: 0.28,
      angleQuality: 0.55,
      pressure: 0.15,
      teamOverall: 80,
      oppTeamOverall: 80,
    };
    const eliteGoal = shotGoalChance({ ...base, shooter: elite });
    const weakGoal = shotGoalChance({ ...base, shooter: weak });
    expect(eliteGoal).toBeGreaterThan(weakGoal);
    expect(eliteGoal - weakGoal).toBeGreaterThan(0.02);
  });
});
