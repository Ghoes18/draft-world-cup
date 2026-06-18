import type { Side, Vec2 } from "../types.js";
import type { Rng } from "../rng.js";
import { GOAL_Y_MIN, GOAL_Y_MAX } from "./constants.js";
import {
  attackDir,
  dist,
  nearestDefender,
  opponentGoalX,
} from "./outcomes.js";
import type {
  LiveAction,
  LiveMatchState,
  LivePlayer,
  LiveTactic,
} from "./types.js";

/** High-level team situation for AI context. */
export type TeamPhase = "attack" | "defend" | "transition" | "restart";

/** Per-player movement/decision role for one tick. */
export type PlayerIntent =
  | { kind: "holdShape"; target: Vec2 }
  | { kind: "support"; target: Vec2 }
  | { kind: "run"; target: Vec2 }
  | { kind: "press"; targetId: string }
  | { kind: "mark"; targetId: string }
  | { kind: "blockLane"; target: Vec2 }
  | { kind: "receive"; target: Vec2 }
  | { kind: "recover"; target: Vec2 }
  | { kind: "chase"; target: Vec2 };

export interface TickPlan {
  phase: TeamPhase;
  /** Ball action for the carrier or primary defender actor. */
  carrierAction: LiveAction;
  /** Player executing carrierAction (null for passive defensive ticks). */
  actorId: string | null;
  /** Movement intent for every outfield player + keeper. */
  intents: Map<string, PlayerIntent>;
}

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function carrier(state: LiveMatchState): LivePlayer | null {
  const id = state.ball.ownerId;
  if (!id) return null;
  return state.players.find((p) => p.id === id) ?? null;
}

function teammates(state: LiveMatchState, side: Side): LivePlayer[] {
  return state.players.filter((p) => p.side === side && !p.isGoalkeeper);
}

function opponents(state: LiveMatchState, side: Side): LivePlayer[] {
  const opp: Side = side === "home" ? "away" : "home";
  return state.players.filter((p) => p.side === opp && !p.isGoalkeeper);
}

function forwardProgress(pos: Vec2, side: Side): number {
  return side === "home" ? pos.x : 1 - pos.x;
}

function isDefenderRole(position: string): boolean {
  return (
    position.includes("B") ||
    position === "RB" ||
    position === "LB" ||
    position === "CB" ||
    position === "RCB" ||
    position === "LCB" ||
    position === "CDM"
  );
}

function isAttackerRole(position: string): boolean {
  return (
    position === "ST" ||
    position === "CF" ||
    position === "RW" ||
    position === "LW" ||
    position === "CAM"
  );
}

/** Derive team phase from ball state and possession. */
export function getTeamPhase(state: LiveMatchState): TeamPhase {
  if (state.setPiece !== null || state.ball.mode === "dead") return "restart";
  if (state.ball.mode === "loose") return "transition";
  const c = carrier(state);
  if (!c) return "transition";
  if (state.ball.mode === "pass" || state.ball.mode === "shot" || state.ball.mode === "cross") {
    return "transition";
  }
  if (c.side === state.possession) return "attack";
  return "defend";
}

/** Support run target ahead of the ball. */
function supportTarget(player: LivePlayer, ball: Vec2): Vec2 {
  const dir = attackDir(player.side);
  const ahead = isAttackerRole(player.position) ? 0.12 : 0.07;
  return {
    x: clamp(ball.x + dir.x * ahead, 0.02, 0.98),
    y: clamp(ball.y + (player.anchor.y - 0.5) * 0.2, 0.05, 0.95),
  };
}

/** Attacking run into space. */
function runTarget(player: LivePlayer, ball: Vec2): Vec2 {
  const dir = attackDir(player.side);
  return {
    x: clamp(ball.x + dir.x * 0.15, 0.02, 0.98),
    y: clamp(player.anchor.y + (ball.y - 0.5) * 0.25, 0.05, 0.95),
  };
}

/** Defensive shape: blend anchor with ball shift. */
function shapeTarget(player: LivePlayer, ball: Vec2, weight: number): Vec2 {
  const w = weight;
  return {
    x: ball.x * w + player.anchor.x * (1 - w),
    y: ball.y * w * 0.6 + player.anchor.y * (1 - w * 0.6),
  };
}

/** Point between ball and a dangerous attacker — passing lane block. */
function blockLaneTarget(
  defender: LivePlayer,
  ball: Vec2,
  threat: LivePlayer,
): Vec2 {
  const mid = {
    x: (ball.x + threat.pos.x) / 2,
    y: (ball.y + threat.pos.y) / 2,
  };
  return {
    x: clamp(mid.x * 0.7 + defender.anchor.x * 0.3, 0.02, 0.98),
    y: clamp(mid.y * 0.7 + defender.anchor.y * 0.3, 0.05, 0.95),
  };
}

/** Trap zone: push ball carrier toward touchline when crowded. */
function trapActive(state: LiveMatchState, carrierPlayer: LivePlayer): boolean {
  const defs = opponents(state, carrierPlayer.side);
  const nearby = defs.filter((d) => dist(d.pos, carrierPlayer.pos) < 0.14);
  const nearTouchline = carrierPlayer.pos.y < 0.22 || carrierPlayer.pos.y > 0.78;
  return nearby.length >= 2 && nearTouchline;
}

function buildAttackIntents(
  state: LiveMatchState,
  carrierPlayer: LivePlayer,
  actorId: string | null,
): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  const ball = state.ball.pos;

  for (const p of state.players) {
    if (p.isGoalkeeper) {
      intents.set(p.id, {
        kind: "holdShape",
        target: {
          x: p.side === "home" ? 0.05 : 0.95,
          y: clamp(ball.y * 0.35 + 0.5 * 0.65, GOAL_Y_MIN, GOAL_Y_MAX),
        },
      });
      continue;
    }

    if (p.id === carrierPlayer.id) continue;

    if (p.id === actorId) continue;

    if (isAttackerRole(p.position) && forwardProgress(p.pos, p.side) > forwardProgress(ball, p.side) - 0.05) {
      intents.set(p.id, { kind: "run", target: runTarget(p, ball) });
    } else if (dist(p.pos, ball) < 0.2) {
      intents.set(p.id, { kind: "support", target: supportTarget(p, ball) });
    } else {
      intents.set(p.id, { kind: "support", target: supportTarget(p, ball) });
    }
  }

  return intents;
}

function buildDefendIntents(
  state: LiveMatchState,
  defendingSide: Side,
  actorId: string | null,
  rng: Rng,
): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  const ball = state.ball.pos;
  const c = carrier(state);
  const defPool = state.players.filter(
    (p) => p.side === defendingSide && !p.isGoalkeeper,
  );
  const atkPool = opponents(state, defendingSide);

  let presser: LivePlayer | null = null;
  let bestD = Infinity;
  for (const d of defPool) {
    const dd = dist(d.pos, ball);
    if (dd < bestD) {
      bestD = dd;
      presser = d;
    }
  }

  const trap = c !== null && trapActive(state, c);

  for (const p of state.players) {
    if (p.isGoalkeeper) {
      intents.set(p.id, {
        kind: "holdShape",
        target: {
          x: p.side === "home" ? 0.05 : 0.95,
          y: clamp(ball.y * 0.35 + 0.5 * 0.65, GOAL_Y_MIN, GOAL_Y_MAX),
        },
      });
      continue;
    }

    if (p.side !== defendingSide) continue;
    if (p.id === actorId) continue;

    if (p.id === presser?.id) {
      if (c) {
        intents.set(p.id, { kind: "press", targetId: c.id });
      } else {
        intents.set(p.id, { kind: "recover", target: ball });
      }
      continue;
    }

    if (trap && !isDefenderRole(p.position) && c) {
      intents.set(p.id, { kind: "press", targetId: c.id });
      continue;
    }

    if (isDefenderRole(p.position) && c) {
      const markTarget = nearestDefender(c.pos, [p]) ? c : atkPool.reduce(
        (best, a) => {
          if (!best) return a;
          const dBest = dist(p.pos, best.pos);
          const dA = dist(p.pos, a.pos);
          return dA < dBest ? a : best;
        },
        null as LivePlayer | null,
      );
      if (markTarget && dist(p.pos, markTarget.pos) < 0.22) {
        intents.set(p.id, { kind: "mark", targetId: markTarget.id });
        continue;
      }
      if (c && rng() < 0.55) {
        intents.set(p.id, {
          kind: "blockLane",
          target: blockLaneTarget(p, ball, c),
        });
        continue;
      }
    }

    const shapeWeight = isDefenderRole(p.position) ? 0.35 : 0.5;
    intents.set(p.id, {
      kind: "holdShape",
      target: shapeTarget(p, ball, shapeWeight),
    });
  }

  return intents;
}

function buildLooseBallIntents(state: LiveMatchState): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  const ball = state.ball.pos;

  for (const p of state.players) {
    if (p.isGoalkeeper) {
      intents.set(p.id, {
        kind: "holdShape",
        target: {
          x: p.side === "home" ? 0.05 : 0.95,
          y: clamp(ball.y * 0.35 + 0.5 * 0.65, GOAL_Y_MIN, GOAL_Y_MAX),
        },
      });
      continue;
    }
    intents.set(p.id, { kind: "chase", target: ball });
  }

  return intents;
}

function buildCrossDefenseIntents(
  state: LiveMatchState,
  defendingSide: Side,
): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  const target = state.ball.targetZone ?? state.ball.pos;
  const ball = state.ball.pos;

  for (const p of state.players) {
    if (p.isGoalkeeper) {
      intents.set(p.id, {
        kind: "holdShape",
        target: {
          x: p.side === "home" ? 0.05 : 0.95,
          y: clamp(target.y * 0.4 + 0.5 * 0.6, GOAL_Y_MIN, GOAL_Y_MAX),
        },
      });
      continue;
    }
    if (p.side !== defendingSide) continue;
    if (isDefenderRole(p.position)) {
      intents.set(p.id, { kind: "recover", target });
    } else {
      intents.set(p.id, { kind: "chase", target: ball });
    }
  }

  return intents;
}

function buildCrossAttackIntents(
  state: LiveMatchState,
  attackingSide: Side,
): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  const target = state.ball.targetZone ?? state.ball.pos;

  for (const p of state.players) {
    if (p.isGoalkeeper) continue;
    if (p.side !== attackingSide) continue;
    if (isAttackerRole(p.position)) {
      intents.set(p.id, { kind: "receive", target });
    } else {
      intents.set(p.id, { kind: "support", target: supportTarget(p, target) });
    }
  }

  return intents;
}

function buildRestartIntents(state: LiveMatchState): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  for (const p of state.players) {
    intents.set(p.id, { kind: "holdShape", target: { ...p.anchor } });
  }
  return intents;
}

/**
 * Corners pre-load the box at setup; hold those positions through the delay so
 * the delivery has live targets instead of everyone drifting back to anchors.
 */
function buildCornerIntents(state: LiveMatchState): Map<string, PlayerIntent> {
  const intents = new Map<string, PlayerIntent>();
  for (const p of state.players) {
    intents.set(p.id, { kind: "holdShape", target: { ...p.pos } });
  }
  return intents;
}

/** Build per-player intents for the current tick. */
export function buildPlayerIntents(
  state: LiveMatchState,
  carrierAction: LiveAction,
  actorId: string | null,
  rng: Rng,
): Map<string, PlayerIntent> {
  const phase = getTeamPhase(state);
  const c = carrier(state);

  if (phase === "restart") {
    if (state.setPiece?.kind === "corner") {
      return buildCornerIntents(state);
    }
    return buildRestartIntents(state);
  }

  if (state.ball.mode === "loose") {
    return buildLooseBallIntents(state);
  }

  if (state.ball.mode === "cross") {
    const attackingSide = state.possession;
    const defendingSide: Side = attackingSide === "home" ? "away" : "home";
    const atk = buildCrossAttackIntents(state, attackingSide);
    const def = buildCrossDefenseIntents(state, defendingSide);
    return new Map([...atk, ...def]);
  }

  if (c && c.side === state.possession && state.ball.mode === "carried") {
    return buildAttackIntents(state, c, actorId);
  }

  const defendingSide: Side =
    state.possession === "home" ? "away" : "home";
  return buildDefendIntents(state, defendingSide, actorId, rng);
}

/** Resolve movement target from a player intent. */
export function intentMovementTarget(
  player: LivePlayer,
  intent: PlayerIntent,
  state: LiveMatchState,
): Vec2 {
  switch (intent.kind) {
    case "holdShape":
    case "support":
    case "run":
    case "blockLane":
    case "receive":
    case "recover":
    case "chase":
      return intent.target;
    case "press":
    case "mark": {
      const t = state.players.find((p) => p.id === intent.targetId);
      return t ? t.pos : player.anchor;
    }
    default: {
      const _exhaustive: never = intent;
      return _exhaustive;
    }
  }
}
