/**
 * Cosmetic filler events. Frequency loosely tracks dominance (each side's λ):
 * the stronger side gets more shots/corners. These NEVER change the score — the
 * `fulltime` event always reconciles to the engine. Tunable (MVP §9 / PRD §15).
 */

import {
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

/** Outfield slots (everyone but the goalkeeper) for picking shooters/passers. */
function outfield(lineup: LineupSlot[]): LineupSlot[] {
  const out = lineup.filter((s) => s.position.toUpperCase() !== "GK");
  return out.length > 0 ? out : lineup;
}

/** A shot/attack location in the attacking third for the given side. */
function attackSpot(rng: Rng, side: Side): Vec2 {
  // Home attacks toward x=1, away toward x=0 (home-attacking-right frame).
  const depth = 0.7 + rng() * 0.25; // 0.70..0.95 from own goal line
  const x = side === "home" ? depth : 1 - depth;
  const y = 0.2 + rng() * 0.6;
  return { x, y };
}

/**
 * Build cosmetic events for one side. `lambda` controls density; `count` of its
 * goals is already known and excluded here (goals are emitted by the generator).
 */
export function buildFiller(
  side: Side,
  lambda: number,
  lineup: LineupSlot[],
  rng: Rng,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const players = outfield(lineup);

  // Non-goal shots: density scales with λ, with a little jitter.
  const shots = Math.max(
    1,
    Math.round(lambda * SHOTS_PER_LAMBDA * (0.75 + rng() * 0.5)),
  );
  for (let i = 0; i < shots; i++) {
    events.push({
      t: randInt(rng, GOAL_MIN_MINUTE, GOAL_MAX_MINUTE),
      type: "shot",
      team: side,
      from: attackSpot(rng, side),
      outcome: pick(rng, NON_GOAL_SHOT_OUTCOMES),
    });
  }

  // Corners: a fraction of total shot volume.
  const corners = Math.round(shots * CORNERS_PER_SHOT);
  for (let i = 0; i < corners; i++) {
    events.push({
      t: randInt(rng, GOAL_MIN_MINUTE, GOAL_MAX_MINUTE),
      type: "corner",
      team: side,
      side: rng() < 0.5 ? "L" : "R",
    });
  }

  // Possession chains: a few short pass sequences between formation anchors.
  const chains = Math.max(2, Math.round(shots * 0.6));
  for (let i = 0; i < chains; i++) {
    events.push({
      t: randInt(rng, GOAL_MIN_MINUTE, GOAL_MAX_MINUTE),
      type: "possession",
      team: side,
      passes: buildPassChain(players, rng),
    });
  }

  return events;
}

function buildPassChain(players: LineupSlot[], rng: Rng): PassHop[] {
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
