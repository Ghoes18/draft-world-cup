/**
 * Linked attack clusters: possession buildup → terminal event (shot, corner, goal).
 * Cosmetic only — never changes the engine score.
 */

import {
  BUILDUP_LEAD_MIN,
  CORNERS_PER_SHOT,
  GOAL_MAX_MINUTE,
  GOAL_MIN_MINUTE,
  PASSES_MAX,
  PASSES_MIN,
  SHOTS_PER_LAMBDA,
} from "../constants.js";
import { pick, randInt, type Rng } from "../rng.js";
import type { LineupSlot, MatchEvent, PassHop, Side, Vec2 } from "../types.js";

const NON_GOAL_SHOT_OUTCOMES = ["saved", "off", "post"] as const;

/** Outfield slots (everyone but the goalkeeper). */
export function outfield(lineup: LineupSlot[]): LineupSlot[] {
  const out = lineup.filter((s) => s.position.toUpperCase() !== "GK");
  return out.length > 0 ? out : lineup;
}

/** A shot/attack location in the attacking third for the given side. */
export function attackSpot(rng: Rng, side: Side): Vec2 {
  const depth = 0.7 + rng() * 0.25;
  const x = side === "home" ? depth : 1 - depth;
  const y = 0.2 + rng() * 0.6;
  return { x, y };
}

/** Short pass sequence between formation anchors. */
export function buildPassChain(players: LineupSlot[], rng: Rng): PassHop[] {
  const hops = randInt(rng, PASSES_MIN, PASSES_MAX);
  const passes: PassHop[] = [];
  let from = pick(rng, players);
  for (let i = 0; i < hops; i++) {
    const to = pick(rng, players);
    passes.push({ fromId: from.playerId, toId: to.playerId, ball: to.anchor });
    from = to;
  }
  return passes;
}

/** Terminal minute must stay after buildup and inside the playable window. */
export function terminalMinute(rng: Rng): number {
  const lo = GOAL_MIN_MINUTE;
  const hi = GOAL_MAX_MINUTE;
  return randInt(rng, lo, hi);
}

export function buildupMinute(terminalT: number): number {
  return Math.max(0, terminalT - BUILDUP_LEAD_MIN);
}

/** Possession buildup that feeds a terminal event at `terminalT`. */
export function buildBuildup(
  side: Side,
  terminalT: number,
  players: LineupSlot[],
  rng: Rng,
): { possession: MatchEvent; lastBall: Vec2; lastReceiverId: string } {
  const passes = buildPassChain(players, rng);
  const lastHop = passes[passes.length - 1]!;
  return {
    possession: {
      t: buildupMinute(terminalT),
      type: "possession",
      team: side,
      passes,
    },
    lastBall: lastHop.ball,
    lastReceiverId: lastHop.toId,
  };
}

/**
 * Cosmetic non-goal attacks for one side. Each cluster is possession → shot
 * or possession → corner, with the terminal `from` aligned to the buildup end.
 */
export function buildAttackClusters(
  side: Side,
  lambda: number,
  lineup: LineupSlot[],
  rng: Rng,
  reservedMinutes: ReadonlySet<number> = new Set(),
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const players = outfield(lineup);

  const attacks = Math.max(
    1,
    Math.round(lambda * SHOTS_PER_LAMBDA * (0.75 + rng() * 0.5)),
  );

  for (let i = 0; i < attacks; i++) {
    let t = terminalMinute(rng);
    let guard = 0;
    while (reservedMinutes.has(t) && guard < 24) {
      t = terminalMinute(rng);
      guard++;
    }
    if (reservedMinutes.has(t)) continue;

    const { possession, lastBall } = buildBuildup(side, t, players, rng);
    events.push(possession);

    if (rng() < CORNERS_PER_SHOT) {
      events.push({
        t,
        type: "corner",
        team: side,
        side: rng() < 0.5 ? "L" : "R",
      });
    } else {
      events.push({
        t,
        type: "shot",
        team: side,
        from: lastBall,
        outcome: pick(rng, NON_GOAL_SHOT_OUTCOMES),
      });
    }
  }

  return events;
}
