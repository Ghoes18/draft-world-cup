import type { Side, Vec2 } from "../types.js";
import type { Rng } from "../rng.js";
import { rngFromSeed } from "../rng.js";
import { simulateShootout, type TeamStrength } from "../engine.js";
import { derivePlayerAttributes, isGoalkeeperPosition } from "./attributes.js";
import { decideTickPlan, movementTargetFromPlan } from "./decision.js";
import {
  BALL_CARRY_OFFSET,
  BOX_DEPTH,
  CORNER_DELAY_TICKS,
  CORNER_FLAG_INSET,
  CORNER_FROM_CLEARANCE_CHANCE,
  CORNER_FROM_SAVE_CHANCE,
  LIVE_MATCH_MINUTES,
  LIVE_TOTAL_TICKS,
  LOOSE_BALL_FRICTION,
  LOOSE_CONTEST_RADIUS,
  LOOSE_PICKUP_RADIUS,
  MAX_BALL_CROSS_STEP,
  MAX_BALL_PASS_STEP,
  MAX_GK_STEP,
  MAX_PLAYER_STEP,
  MAX_STOPPAGE_TICKS,
  RESTART_DELAY_TICKS,
  SET_PIECE_DELAY_TICKS,
  STAMINA_DRAIN,
  STAMINA_RECOVERY,
  STOPPAGE_TICKS_PER_FOUL,
  STOPPAGE_TICKS_PER_GOAL,
  TICKS_PER_MINUTE,
} from "./constants.js";
import type { TickPlan } from "./phase.js";
import {
  aerialContestChance,
  angleQuality,
  countNearby,
  crossDeliveryChance,
  dist,
  dribbleSuccessChance,
  foulOnTackleChance,
  isInPenaltyBox,
  looseBallContestScore,
  nearestDefender,
  opponentGoalX,
  passSuccessChance,
  penaltyKickChance,
  penaltySpot,
  rollOutcome,
  saveChance,
  shotOffTargetChance,
  tackleSuccessChance,
} from "./outcomes.js";
import { stateToSnapshot } from "./snapshots.js";
import type {
  LiveAction,
  LiveMatchConfig,
  LiveMatchEvent,
  LiveMatchResult,
  LiveMatchState,
  LivePlayer,
  LiveSnapshot,
  SetPieceKind,
} from "./types.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function clampVec(v: Vec2): Vec2 {
  return { x: clamp(v.x, 0.02, 0.98), y: clamp(v.y, 0.05, 0.95) };
}

function oppSide(side: Side): Side {
  return side === "home" ? "away" : "home";
}

function teamOverall(state: LiveMatchState, side: Side): number {
  return state.teamOveralls[side];
}

function matchEndTick(state: LiveMatchState): number {
  return state.regulationEndTick + state.stoppageTicks;
}

function addStoppage(state: LiveMatchState, ticks: number): void {
  state.stoppageTicks = clamp(state.stoppageTicks + ticks, 0, MAX_STOPPAGE_TICKS);
}

function moveToward(
  from: Vec2,
  to: Vec2,
  maxStep: number,
): { pos: Vec2; vel: Vec2 } {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const d = Math.sqrt(dx * dx + dy * dy);
  if (d <= maxStep || d < 1e-6) {
    return { pos: { ...to }, vel: { x: dx, y: dy } };
  }
  const scale = maxStep / d;
  return {
    pos: { x: from.x + dx * scale, y: from.y + dy * scale },
    vel: { x: dx * scale, y: dy * scale },
  };
}

function playerById(state: LiveMatchState, id: string): LivePlayer | undefined {
  return state.players.find((p) => p.id === id);
}

function logEvent(
  state: LiveMatchState,
  event: Omit<LiveMatchEvent, "tick" | "minute">,
): void {
  state.events.push({
    tick: state.tick,
    minute: state.minute,
    ...event,
  });
}

function findKickoffPlayer(state: LiveMatchState, side: Side): LivePlayer {
  return (
    state.players.find((p) => p.side === side && p.position === "CM") ??
    state.players.find((p) => p.side === side && !p.isGoalkeeper)!
  );
}

function findGoalkeeper(state: LiveMatchState, side: Side): LivePlayer {
  return state.players.find((p) => p.side === side && p.isGoalkeeper)!;
}

function pickSetPieceTaker(state: LiveMatchState, side: Side): LivePlayer {
  return (
    state.players.find((p) => p.side === side && p.position === "ST" && !p.isGoalkeeper) ??
    state.players.find((p) => p.side === side && !p.isGoalkeeper && p.position.includes("M")) ??
    findKickoffPlayer(state, side)
  );
}

/** Build initial match state from config. */
export function createLiveMatchState(config: LiveMatchConfig): LiveMatchState {
  const players: LivePlayer[] = [];
  for (const side of ["home", "away"] as const) {
    const overall = config.teamOveralls[side];
    for (const slot of config.lineups[side]) {
      const attrs = derivePlayerAttributes(
        slot,
        side,
        overall,
        config.playerOveralls,
      );
      players.push({
        id: slot.playerId,
        side,
        number: slot.number,
        position: slot.position,
        anchor: { ...slot.anchor },
        pos: { ...slot.anchor },
        vel: { x: 0, y: 0 },
        attrs,
        stamina: 1,
        isGoalkeeper: isGoalkeeperPosition(slot.position),
      });
    }
  }

  const kickoffSide: Side = "home";
  const kickoffPlayer =
    players.find((p) => p.side === kickoffSide && p.position === "CM") ??
    players.find((p) => p.side === kickoffSide && !p.isGoalkeeper)!;

  const ball = {
    pos: { ...kickoffPlayer.pos },
    vel: { x: 0, y: 0 },
    mode: "carried" as const,
    ownerId: kickoffPlayer.id,
    targetId: null,
    throughBall: false,
    targetZone: null,
    restartDelay: 0,
    lastTouchId: kickoffPlayer.id,
    lastTouchSide: kickoffSide,
  };

  const state: LiveMatchState = {
    seed: config.seed,
    tick: 0,
    minute: 0,
    homeScore: 0,
    awayScore: 0,
    possession: kickoffSide,
    teamOveralls: { ...config.teamOveralls },
    players,
    ball,
    events: [],
    finished: false,
    regulationEndTick: LIVE_TOTAL_TICKS,
    stoppageTicks: 0,
    segment: "open_play",
    setPiece: null,
    knockout: config.knockout ?? false,
  };

  logEvent(state, { type: "kickoff", side: kickoffSide, playerId: kickoffPlayer.id });
  return state;
}

function scheduleDeadBall(state: LiveMatchState, restartSide: Side): void {
  state.ball.mode = "dead";
  state.ball.ownerId = null;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = null;
  state.ball.vel = { x: 0, y: 0 };
  state.possession = restartSide;
  state.ball.restartDelay = RESTART_DELAY_TICKS;
}

function releaseLooseBall(state: LiveMatchState, pos: Vec2, vel?: Vec2): void {
  state.ball.mode = "loose";
  state.ball.ownerId = null;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = null;
  state.ball.pos = clampVec(pos);
  state.ball.vel = vel ?? { x: 0, y: 0 };
  state.ball.restartDelay = 0;
}

function scheduleSetPiece(
  state: LiveMatchState,
  kind: SetPieceKind,
  side: Side,
  spot: Vec2,
): void {
  const taker = pickSetPieceTaker(state, side);
  state.setPiece = {
    kind,
    side,
    spot: clampVec(spot),
    takerId: taker.id,
    delayTicks: SET_PIECE_DELAY_TICKS,
  };
  state.ball.pos = clampVec(spot);
  state.ball.mode = "dead";
  state.ball.ownerId = null;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = null;
  state.ball.vel = { x: 0, y: 0 };
  state.possession = side;
  state.ball.restartDelay = SET_PIECE_DELAY_TICKS;
  addStoppage(state, STOPPAGE_TICKS_PER_FOUL);
  logEvent(state, {
    type: kind === "penalty" ? "penalty" : "freekick",
    side,
    playerId: taker.id,
    detail: kind,
  });
}

/** Corner-flag spot for the attacking side, on the near touchline to `exitY`. */
function cornerFlagSpot(attackingSide: Side, exitY: number): Vec2 {
  // The attacking side takes the corner at the defending team's goal line.
  const goalX = opponentGoalX(attackingSide); // 1 for home, 0 for away
  const x = goalX === 1 ? 1 - CORNER_FLAG_INSET : CORNER_FLAG_INSET;
  const y = exitY < 0.5 ? CORNER_FLAG_INSET : 1 - CORNER_FLAG_INSET;
  return { x, y };
}

/** Center of the attacking penalty box (corner delivery target). */
function attackingBoxZone(attackingSide: Side, exitY: number): Vec2 {
  const goalX = opponentGoalX(attackingSide);
  const x = goalX === 1 ? 1 - BOX_DEPTH * 0.6 : BOX_DEPTH * 0.6;
  // Bias the delivery slightly toward the side the ball went out on.
  const y = clamp(0.5 + (exitY < 0.5 ? -0.05 : 0.05), 0.4, 0.6);
  return { x, y };
}

/** Force a set-piece shape: taker at the flag, two attackers + two markers in the box. */
function loadCornerBox(
  state: LiveMatchState,
  attackingSide: Side,
  taker: LivePlayer,
  flag: Vec2,
  zone: Vec2,
): void {
  taker.pos = clampVec(flag);
  taker.vel = { x: 0, y: 0 };

  const offsets: Vec2[] = [
    { x: 0, y: -0.06 },
    { x: -0.05, y: 0.05 },
    { x: 0.04, y: 0.02 },
  ];

  const attackers = state.players
    .filter((p) => p.side === attackingSide && !p.isGoalkeeper && p.id !== taker.id)
    .sort((a, b) => forwardProgress(b, attackingSide) - forwardProgress(a, attackingSide))
    .slice(0, 3);
  attackers.forEach((p, i) => {
    const o = offsets[i] ?? { x: 0, y: 0 };
    p.pos = clampVec({ x: zone.x + o.x, y: zone.y + o.y });
    p.vel = { x: 0, y: 0 };
  });

  const defSide = oppSide(attackingSide);
  const defenders = state.players
    .filter((p) => p.side === defSide && !p.isGoalkeeper)
    .sort((a, b) => forwardProgress(a, attackingSide) - forwardProgress(b, attackingSide))
    .slice(0, 3);
  defenders.forEach((p, i) => {
    const o = offsets[i] ?? { x: 0, y: 0 };
    p.pos = clampVec({ x: zone.x + o.x * 0.6, y: zone.y + o.y * 0.6 + 0.015 });
    p.vel = { x: 0, y: 0 };
  });
}

function forwardProgress(player: LivePlayer, side: Side): number {
  return side === "home" ? player.pos.x : 1 - player.pos.x;
}

/** Award a corner to `attackingSide` and set up the box. */
function scheduleCorner(state: LiveMatchState, attackingSide: Side, exitY: number): void {
  const flag = cornerFlagSpot(attackingSide, exitY);
  const zone = attackingBoxZone(attackingSide, exitY);
  // Prefer a wide attacker near the flag as the taker.
  const taker =
    state.players
      .filter((p) => p.side === attackingSide && !p.isGoalkeeper)
      .sort((a, b) => dist(a.anchor, flag) - dist(b.anchor, flag))[0] ??
    pickSetPieceTaker(state, attackingSide);

  loadCornerBox(state, attackingSide, taker, flag, zone);

  state.setPiece = {
    kind: "corner",
    side: attackingSide,
    spot: clampVec(flag),
    takerId: taker.id,
    delayTicks: CORNER_DELAY_TICKS,
  };
  state.ball.pos = clampVec(flag);
  state.ball.mode = "dead";
  state.ball.ownerId = null;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = null;
  state.ball.vel = { x: 0, y: 0 };
  state.ball.restartDelay = CORNER_DELAY_TICKS;
  state.possession = attackingSide;
  logEvent(state, {
    type: "corner",
    side: attackingSide,
    playerId: taker.id,
    detail: exitY < 0.5 ? "left" : "right",
  });
}

/** Record the last player to deliberately play the ball (corner vs goal kick). */
function recordTouch(state: LiveMatchState, player: LivePlayer): void {
  state.ball.lastTouchId = player.id;
  state.ball.lastTouchSide = player.side;
}

function attachBallToCarrier(state: LiveMatchState, carrier: LivePlayer): void {
  const dir = carrier.side === "home" ? 1 : -1;
  state.ball.pos = clampVec({
    x: carrier.pos.x + dir * BALL_CARRY_OFFSET,
    y: carrier.pos.y,
  });
  state.ball.vel = { ...carrier.vel };
  state.ball.mode = "carried";
  state.ball.ownerId = carrier.id;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = null;
  state.ball.restartDelay = 0;
  state.possession = carrier.side;
  state.setPiece = null;
  recordTouch(state, carrier);
}

function awardFoul(
  state: LiveMatchState,
  fouledSide: Side,
  spot: Vec2,
): void {
  logEvent(state, {
    type: "foul",
    side: fouledSide,
    detail: "tackle",
  });
  if (isInPenaltyBox(spot, fouledSide)) {
    scheduleSetPiece(state, "penalty", fouledSide, penaltySpot(fouledSide));
    return;
  }
  scheduleSetPiece(state, "freekick", fouledSide, spot);
}

/** Recover dead ball — set pieces, goal kicks, or contested pickup. */
function recoverDeadBall(state: LiveMatchState, rng: Rng): void {
  if (state.ball.mode !== "dead") return;

  if (state.setPiece !== null) {
    if (state.ball.restartDelay > 0) {
      state.ball.restartDelay--;
      state.setPiece.delayTicks--;
      return;
    }
    const taker = playerById(state, state.setPiece.takerId);
    if (!taker) {
      state.setPiece = null;
      return;
    }
    taker.pos = clampVec({
      x: state.setPiece.spot.x,
      y: state.setPiece.spot.y,
    });
    attachBallToCarrier(state, taker);
    return;
  }

  if (state.ball.restartDelay > 0) {
    state.ball.restartDelay--;
    return;
  }

  const side = state.possession;
  const ball = state.ball.pos;
  const nearGoal =
    (side === "home" && ball.x < 0.15) ||
    (side === "away" && ball.x > 0.85) ||
    ball.y < 0.05 ||
    ball.y > 0.95;

  if (nearGoal) {
    const gk = findGoalkeeper(state, side);
    attachBallToCarrier(state, gk);
    logEvent(state, {
      type: "goalkick",
      side,
      playerId: gk.id,
    });
    return;
  }

  const candidates = state.players.filter((p) => !p.isGoalkeeper);
  let best: LivePlayer | null = null;
  let bestScore = -Infinity;
  for (const p of candidates) {
    const d = dist(p.pos, ball);
    if (d > LOOSE_CONTEST_RADIUS) continue;
    const score = looseBallContestScore({
      player: p,
      distance: d,
      teamOverall: teamOverall(state, p.side),
      oppTeamOverall: teamOverall(state, oppSide(p.side)),
    });
    if (score > bestScore) {
      bestScore = score;
      best = p;
    }
  }

  if (best && dist(best.pos, ball) <= LOOSE_PICKUP_RADIUS && rollOutcome(rng, 0.5 + bestScore / 250)) {
    attachBallToCarrier(state, best);
    logEvent(state, {
      type: "turnover",
      side: best.side,
      playerId: best.id,
      detail: "collected loose ball",
    });
    return;
  }

  releaseLooseBall(state, ball, state.ball.vel);
}

function updateLooseBall(state: LiveMatchState, rng: Rng): void {
  if (state.ball.mode !== "loose") return;

  state.ball.vel = {
    x: state.ball.vel.x * LOOSE_BALL_FRICTION,
    y: state.ball.vel.y * LOOSE_BALL_FRICTION,
  };
  state.ball.pos = clampVec({
    x: state.ball.pos.x + state.ball.vel.x,
    y: state.ball.pos.y + state.ball.vel.y,
  });

  const contenders = state.players.filter((p) => !p.isGoalkeeper);
  const nearby = contenders
    .map((p) => ({
      player: p,
      distance: dist(p.pos, state.ball.pos),
      score: looseBallContestScore({
        player: p,
        distance: dist(p.pos, state.ball.pos),
        teamOverall: teamOverall(state, p.side),
        oppTeamOverall: teamOverall(state, oppSide(p.side)),
      }),
    }))
    .filter((c) => c.distance <= LOOSE_CONTEST_RADIUS)
    .sort((a, b) => b.score - a.score);

  if (nearby.length === 0) return;

  const winner = nearby[0]!;
  if (winner.distance > LOOSE_PICKUP_RADIUS) return;

  const contested = nearby.length > 1 && nearby[1]!.distance <= LOOSE_PICKUP_RADIUS;
  const winChance = contested ? 0.45 + winner.score / 300 : 0.72 + winner.score / 400;

  if (rollOutcome(rng, winChance)) {
    attachBallToCarrier(state, winner.player);
    logEvent(state, {
      type: "turnover",
      side: winner.player.side,
      playerId: winner.player.id,
      detail: contested ? "won loose ball contest" : "collected loose ball",
    });
  }
}

function updateStamina(player: LivePlayer, intense: boolean): void {
  if (intense) {
    player.stamina = clamp(player.stamina - STAMINA_DRAIN, 0.2, 1);
  } else {
    player.stamina = clamp(player.stamina + STAMINA_RECOVERY, 0.2, 1);
  }
}

function updatePlayerMovement(state: LiveMatchState, plan: TickPlan): void {
  const actorId = plan.actorId;
  const action = plan.carrierAction;

  for (const p of state.players) {
    const isActor = p.id === actorId;
    const chaseBoost =
      state.ball.mode === "loose" || state.ball.mode === "cross" ? 1.08 : 1;
    const maxStep =
      (p.isGoalkeeper ? MAX_GK_STEP : MAX_PLAYER_STEP) *
      chaseBoost *
      (0.75 + 0.25 * p.stamina) *
      (p.attrs.pace / 80);
    const target = movementTargetFromPlan(
      p,
      plan,
      state,
      isActor ? action : null,
    );
    const moved = moveToward(p.pos, target, maxStep);
    p.pos = clampVec(moved.pos);
    p.vel = moved.vel;
    const intense =
      isActor &&
      (action.kind === "press" ||
        action.kind === "tackle" ||
        action.kind === "dribble" ||
        action.kind === "carry");
    updateStamina(p, intense);
  }
}

function startPass(
  state: LiveMatchState,
  passer: LivePlayer,
  targetId: string,
  through: boolean,
): void {
  const target = playerById(state, targetId);
  if (!target) return;
  state.ball.mode = "pass";
  state.ball.ownerId = passer.id;
  state.ball.targetId = targetId;
  state.ball.throughBall = through;
  state.ball.targetZone = null;
  const dx = target.pos.x - passer.pos.x;
  const dy = target.pos.y - passer.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const speed = Math.min(MAX_BALL_PASS_STEP, d / 7);
  state.ball.vel = { x: (dx / d) * speed, y: (dy / d) * speed };
  state.ball.pos = { ...passer.pos };
  recordTouch(state, passer);
}

function startCross(
  state: LiveMatchState,
  crosser: LivePlayer,
  targetZone: Vec2,
): void {
  state.ball.mode = "cross";
  state.ball.ownerId = crosser.id;
  state.ball.targetId = null;
  state.ball.throughBall = false;
  state.ball.targetZone = { ...targetZone };
  const dx = targetZone.x - crosser.pos.x;
  const dy = targetZone.y - crosser.pos.y;
  const d = Math.sqrt(dx * dx + dy * dy) || 1;
  const speed = Math.min(MAX_BALL_CROSS_STEP, d / 9);
  state.ball.vel = { x: (dx / d) * speed, y: (dy / d) * speed };
  state.ball.pos = { ...crosser.pos };
  recordTouch(state, crosser);
}

function resolvePassArrival(state: LiveMatchState, rng: Rng): void {
  const targetId = state.ball.targetId;
  if (!targetId) {
    releaseLooseBall(state, state.ball.pos, state.ball.vel);
    return;
  }
  const passer = state.ball.ownerId
    ? playerById(state, state.ball.ownerId)
    : null;
  const receiver = playerById(state, targetId);
  if (!passer || !receiver) {
    releaseLooseBall(state, state.ball.pos, state.ball.vel);
    return;
  }
  const defs = state.players.filter(
    (p) => p.side !== passer.side && !p.isGoalkeeper,
  );
  const chance = passSuccessChance({
    passer,
    receiver,
    defenders: defs,
    throughBall: state.ball.throughBall,
    teamOverall: teamOverall(state, passer.side),
    oppTeamOverall: teamOverall(state, oppSide(passer.side)),
  });
  if (rollOutcome(rng, chance)) {
    state.possession = receiver.side;
    attachBallToCarrier(state, receiver);
    logEvent(state, {
      type: "pass",
      side: passer.side,
      playerId: passer.id,
      targetId: receiver.id,
    });
  } else {
    const interceptor = nearestDefender(state.ball.pos, defs);
    if (interceptor && dist(interceptor.pos, state.ball.pos) < 0.08) {
      attachBallToCarrier(state, interceptor);
      logEvent(state, {
        type: "turnover",
        side: interceptor.side,
        playerId: interceptor.id,
        detail: "intercepted pass",
      });
    } else {
      releaseLooseBall(state, state.ball.pos, {
        x: state.ball.vel.x * 0.5,
        y: state.ball.vel.y * 0.5,
      });
      logEvent(state, {
        type: "turnover",
        side: oppSide(passer.side),
        detail: "incomplete pass",
      });
    }
  }
}

function resolveCrossArrival(state: LiveMatchState, rng: Rng): void {
  const crosser = state.ball.ownerId ? playerById(state, state.ball.ownerId) : null;
  const zone = state.ball.targetZone;
  if (!crosser || !zone) {
    releaseLooseBall(state, state.ball.pos, state.ball.vel);
    return;
  }

  const atkSide = crosser.side;
  const defSide = oppSide(atkSide);
  const attackers = state.players.filter(
    (p) => p.side === atkSide && !p.isGoalkeeper && dist(p.pos, zone) < 0.14,
  );
  const defenders = state.players.filter(
    (p) => p.side === defSide && !p.isGoalkeeper && dist(p.pos, zone) < 0.14,
  );
  const primaryTarget =
    attackers.sort((a, b) => dist(a.pos, zone) - dist(b.pos, zone))[0] ?? null;

  if (!primaryTarget) {
    releaseLooseBall(state, zone, { x: 0, y: 0 });
    logEvent(state, {
      type: "cross",
      side: atkSide,
      playerId: crosser.id,
      detail: "no target",
    });
    return;
  }

  const delivery = crossDeliveryChance({
    crosser,
    target: primaryTarget,
    defenders,
    teamOverall: teamOverall(state, atkSide),
    oppTeamOverall: teamOverall(state, defSide),
  });

  if (!rollOutcome(rng, delivery)) {
    releaseLooseBall(state, zone, { x: (rng() - 0.5) * 0.01, y: (rng() - 0.5) * 0.01 });
    logEvent(state, {
      type: "cross",
      side: atkSide,
      playerId: crosser.id,
      detail: "overhit",
    });
    return;
  }

  const nearestDef = nearestDefender(zone, defenders);
  const aerial = aerialContestChance(
    primaryTarget,
    nearestDef,
    teamOverall(state, atkSide),
    teamOverall(state, defSide),
  );

  logEvent(state, {
    type: "cross",
    side: atkSide,
    playerId: crosser.id,
    targetId: primaryTarget.id,
  });

  if (rollOutcome(rng, aerial)) {
    attachBallToCarrier(state, primaryTarget);
    // A won header in the box is usually an attempt on goal, not just control.
    if (isInPenaltyBox(primaryTarget.pos, atkSide) && rollOutcome(rng, 0.75)) {
      state.ball.mode = "shot";
      resolveShot(state, primaryTarget, rng);
    }
    return;
  }

  if (nearestDef && rollOutcome(rng, 0.55)) {
    if (rollOutcome(rng, CORNER_FROM_CLEARANCE_CHANCE)) {
      // Defender heads the cross behind for a corner.
      recordTouch(state, nearestDef);
      scheduleCorner(state, atkSide, zone.y);
      return;
    }
    attachBallToCarrier(state, nearestDef);
    logEvent(state, {
      type: "turnover",
      side: nearestDef.side,
      playerId: nearestDef.id,
      detail: "cleared cross",
    });
    return;
  }

  releaseLooseBall(state, zone, { x: 0, y: 0 });
}

function resolvePenalty(state: LiveMatchState, taker: LivePlayer, rng: Rng): void {
  const gkSide = oppSide(taker.side);
  const gk = findGoalkeeper(state, gkSide);
  const chance = penaltyKickChance(
    taker,
    gk,
    teamOverall(state, taker.side),
    teamOverall(state, gkSide),
  );
  logEvent(state, { type: "shot", side: taker.side, playerId: taker.id, detail: "penalty" });
  if (rollOutcome(rng, chance)) {
    if (taker.side === "home") state.homeScore++;
    else state.awayScore++;
    addStoppage(state, STOPPAGE_TICKS_PER_GOAL);
    logEvent(state, { type: "goal", side: taker.side, playerId: taker.id, detail: "penalty" });
    const restartPlayer = findKickoffPlayer(state, gkSide);
    attachBallToCarrier(state, restartPlayer);
    return;
  }
  attachBallToCarrier(state, gk);
  logEvent(state, {
    type: "save",
    side: gkSide,
    playerId: gk.id,
    targetId: taker.id,
    detail: "penalty saved",
  });
}

function resolveShot(state: LiveMatchState, shooter: LivePlayer, rng: Rng): void {
  const gkSide: Side = oppSide(shooter.side);
  const gk = findGoalkeeper(state, gkSide);
  const goalX = opponentGoalX(shooter.side);
  const distanceToGoal = dist(shooter.pos, { x: goalX, y: 0.5 });
  const defs = state.players.filter(
    (p) => p.side !== shooter.side && !p.isGoalkeeper,
  );
  const pressure = countNearby(shooter.pos, defs, 0.1) * 0.2;
  const ctx = {
    shooter,
    keeper: gk,
    distanceToGoal,
    angleQuality: angleQuality(shooter.pos, goalX),
    pressure,
    teamOverall: teamOverall(state, shooter.side),
    oppTeamOverall: teamOverall(state, gkSide),
  };

  const fromPenalty = state.setPiece?.kind === "penalty";
  if (fromPenalty) {
    resolvePenalty(state, shooter, rng);
    state.setPiece = null;
    return;
  }

  logEvent(state, { type: "shot", side: shooter.side, playerId: shooter.id });

  if (rollOutcome(rng, shotOffTargetChance(ctx))) {
    releaseLooseBall(state, clampVec({
      x: gkSide === "home" ? 0.08 : 0.92,
      y: clamp(shooter.pos.y, 0.42, 0.58),
    }));
    logEvent(state, {
      type: "turnover",
      side: gkSide,
      detail: "shot off target",
    });
    return;
  }

  if (rollOutcome(rng, saveChance(ctx))) {
    if (rollOutcome(rng, CORNER_FROM_SAVE_CHANCE)) {
      // Keeper parries it behind for a corner.
      recordTouch(state, gk);
      logEvent(state, {
        type: "save",
        side: gkSide,
        playerId: gk.id,
        targetId: shooter.id,
        detail: "parried",
      });
      scheduleCorner(state, shooter.side, shooter.pos.y);
      return;
    }
    attachBallToCarrier(state, gk);
    logEvent(state, {
      type: "save",
      side: gkSide,
      playerId: gk.id,
      targetId: shooter.id,
    });
    return;
  }

  // On target and the keeper is beaten → goal. (No extra gate: a shot that is
  // on target and unsaved is a goal — the old third roll just ate scoring.)
  if (shooter.side === "home") state.homeScore++;
  else state.awayScore++;
  addStoppage(state, STOPPAGE_TICKS_PER_GOAL);
  logEvent(state, {
    type: "goal",
    side: shooter.side,
    playerId: shooter.id,
  });
  const restartPlayer = findKickoffPlayer(state, gkSide);
  attachBallToCarrier(state, restartPlayer);
}

function applyAction(
  state: LiveMatchState,
  action: LiveAction,
  actorId: string | null,
  rng: Rng,
): string | null {
  const c = state.ball.ownerId ? playerById(state, state.ball.ownerId) : null;

  switch (action.kind) {
    case "hold":
      return c?.id ?? actorId;

    case "carry": {
      if (!c) return actorId;
      const step = MAX_PLAYER_STEP * 0.95;
      c.pos = clampVec({
        x: c.pos.x + action.direction.x * step,
        y: c.pos.y + action.direction.y * step,
      });
      attachBallToCarrier(state, c);
      return c.id;
    }

    case "pass":
    case "through": {
      if (!c) return actorId;
      startPass(state, c, action.targetId, action.kind === "through");
      return c.id;
    }

    case "cross": {
      if (!c) return actorId;
      startCross(state, c, action.targetZone);
      return c.id;
    }

    case "dribble": {
      if (!c) return actorId;
      const defs = state.players.filter(
        (p) => p.side !== c.side && !p.isGoalkeeper,
      );
      const defender = nearestDefender(c.pos, defs);
      const congestion = countNearby(c.pos, defs, 0.08) * 0.15;
      const chance = dribbleSuccessChance({
        attacker: c,
        defender,
        congestion,
        teamOverall: teamOverall(state, c.side),
        oppTeamOverall: teamOverall(state, oppSide(c.side)),
      });
      const step = MAX_PLAYER_STEP * 1.15;
      c.pos = clampVec({
        x: c.pos.x + action.direction.x * step,
        y: c.pos.y + action.direction.y * step,
      });
      if (rollOutcome(rng, chance)) {
        attachBallToCarrier(state, c);
        logEvent(state, { type: "dribble", side: c.side, playerId: c.id });
      } else if (defender) {
        attachBallToCarrier(state, defender);
        logEvent(state, {
          type: "tackle",
          side: defender.side,
          playerId: defender.id,
          targetId: c.id,
        });
      }
      return c.id;
    }

    case "shoot": {
      if (!c) return actorId;
      state.ball.mode = "shot";
      const goalX = opponentGoalX(c.side);
      const dx = goalX - c.pos.x;
      const dy = 0.5 - c.pos.y;
      const d = Math.sqrt(dx * dx + dy * dy) || 1;
      const speed = MAX_BALL_PASS_STEP * 1.35;
      state.ball.vel = { x: (dx / d) * speed, y: (dy / d) * speed };
      state.ball.ownerId = c.id;
      recordTouch(state, c);
      resolveShot(state, c, rng);
      return c.id;
    }

    case "tackle": {
      const attacker = playerById(state, action.targetId);
      const tackler = actorId ? playerById(state, actorId) : null;
      if (!attacker || !tackler) return actorId;
      const d = dist(tackler.pos, attacker.pos);
      const chance = tackleSuccessChance({
        defender: tackler,
        attacker,
        distance: d,
        teamOverall: teamOverall(state, tackler.side),
        oppTeamOverall: teamOverall(state, oppSide(tackler.side)),
      });
      if (rollOutcome(rng, chance)) {
        attachBallToCarrier(state, tackler);
        logEvent(state, {
          type: "tackle",
          side: tackler.side,
          playerId: tackler.id,
          targetId: attacker.id,
        });
      } else if (
        rollOutcome(
          rng,
          foulOnTackleChance({ defender: tackler, attacker, distance: d }),
        )
      ) {
        const spot = clampVec({
          x: (tackler.pos.x + attacker.pos.x) / 2,
          y: (tackler.pos.y + attacker.pos.y) / 2,
        });
        awardFoul(state, attacker.side, spot);
      }
      return tackler.id;
    }

    case "press":
    case "intercept":
    case "recover":
      return actorId;

    default: {
      const _exhaustive: never = action;
      return _exhaustive;
    }
  }
}

function advanceBall(state: LiveMatchState, rng: Rng): void {
  const ball = state.ball;
  if (ball.mode === "carried" || ball.mode === "dead" || ball.mode === "loose") {
    return;
  }

  ball.pos = {
    x: ball.pos.x + ball.vel.x,
    y: ball.pos.y + ball.vel.y,
  };

  if (ball.mode === "pass" && ball.targetId) {
    const target = playerById(state, ball.targetId);
    if (target && dist(ball.pos, target.pos) < 0.028) {
      resolvePassArrival(state, rng);
    }
  }

  if (ball.mode === "cross" && ball.targetZone) {
    if (dist(ball.pos, ball.targetZone) < 0.032) {
      resolveCrossArrival(state, rng);
    }
  }

  // Byline exit → corner (defender's last touch) or goal kick (attacker's last touch).
  if (ball.pos.x < 0 || ball.pos.x > 1) {
    const lineSide: Side = ball.pos.x < 0 ? "home" : "away"; // whose goal line it crossed
    const attackingSide = oppSide(lineSide);
    const exitY = clamp(ball.pos.y, 0, 1);
    if (state.ball.lastTouchSide === lineSide) {
      // A defender put it behind for a corner.
      scheduleCorner(state, attackingSide, exitY);
    } else {
      // Attacker (or unknown) sent it out → goal kick to the defending side.
      ball.pos = clampVec({
        x: clamp(ball.pos.x, 0.05, 0.95),
        y: clamp(ball.pos.y, 0.1, 0.9),
      });
      scheduleDeadBall(state, lineSide);
    }
    return;
  }

  // Touchline exit → throw-in to whoever did not touch it last.
  if (ball.pos.y < 0 || ball.pos.y > 1) {
    const restart = state.ball.lastTouchSide
      ? oppSide(state.ball.lastTouchSide)
      : state.possession;
    ball.pos = clampVec({
      x: clamp(ball.pos.x, 0.05, 0.95),
      y: clamp(ball.pos.y, 0.05, 0.95),
    });
    scheduleDeadBall(state, restart);
  }
}

function finalizeBallForWhistle(state: LiveMatchState): void {
  if (state.ball.mode === "carried" && state.ball.ownerId !== null) return;

  let nearest: LivePlayer | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    if (p.isGoalkeeper) continue;
    const d = dist(p.pos, state.ball.pos);
    if (d < bestD) {
      bestD = d;
      nearest = p;
    }
  }
  if (nearest) {
    attachBallToCarrier(state, nearest);
  }
}

function finishMatch(state: LiveMatchState, rng: Rng): void {
  if (state.stoppageTicks > 0) {
    const extraMin = Math.round((state.stoppageTicks / TICKS_PER_MINUTE) * 10) / 10;
    logEvent(state, {
      type: "stoppage",
      side: "home",
      detail: `+${extraMin}`,
    });
  }

  finalizeBallForWhistle(state);

  state.finished = true;
  logEvent(state, {
    type: "fulltime",
    side: "home",
    detail: `${state.homeScore}-${state.awayScore}`,
  });

  if (
    state.knockout &&
    state.homeScore === state.awayScore &&
    state.segment === "open_play"
  ) {
    const home: TeamStrength = {
      attack: state.teamOveralls.home,
      defense: state.teamOveralls.home,
      overall: state.teamOveralls.home,
    };
    const away: TeamStrength = {
      attack: state.teamOveralls.away,
      defense: state.teamOveralls.away,
      overall: state.teamOveralls.away,
    };
    const shootout = simulateShootout(home, away, rng);
    state.shootout = { tally: shootout.tally, winner: shootout.winner };
    state.segment = "shootout";
    logEvent(state, {
      type: "shootout",
      side: shootout.winner,
      detail: `${shootout.tally[0]}-${shootout.tally[1]}`,
    });
  }
}

/** Advance simulation by one tick. */
export function tickLiveMatch(
  state: LiveMatchState,
  tactics: Record<Side, import("./types.js").LiveTactic>,
  rng: Rng,
): void {
  if (state.finished) return;

  state.tick++;
  state.minute = state.tick / TICKS_PER_MINUTE;

  recoverDeadBall(state, rng);

  const plan = decideTickPlan(state, tactics, rng);
  const actorId = applyAction(state, plan.carrierAction, plan.actorId, rng);
  updatePlayerMovement(state, { ...plan, actorId: actorId ?? plan.actorId });
  updateLooseBall(state, rng);
  advanceBall(state, rng);

  if (state.ball.mode === "carried" && state.ball.ownerId) {
    const c = playerById(state, state.ball.ownerId);
    if (c) attachBallToCarrier(state, c);
  }

  if (state.tick >= matchEndTick(state)) {
    finishMatch(state, rng);
  }
}

export interface SimulateLiveOptions {
  snapshotStride?: number;
  maxTicks?: number;
}

function resolveWinner(state: LiveMatchState): Side | "draw" {
  if (state.shootout) return state.shootout.winner;
  if (state.homeScore > state.awayScore) return "home";
  if (state.awayScore > state.homeScore) return "away";
  return "draw";
}

/** Run a complete live match. Same seed reproduces the same run; outcomes are chance-based. */
export function simulateLiveMatch(
  config: LiveMatchConfig,
  options: SimulateLiveOptions = {},
): LiveMatchResult {
  const stride = options.snapshotStride ?? 3;
  const rng = rngFromSeed(`${config.seed}:live`);
  const state = createLiveMatchState(config);
  const snapshots: LiveSnapshot[] = [];

  snapshots.push(stateToSnapshot(state));

  while (!state.finished) {
    tickLiveMatch(state, config.tactics, rng);
    if (options.maxTicks !== undefined && state.tick >= options.maxTicks) {
      state.finished = true;
      break;
    }
    if (state.tick % stride === 0 || state.finished) {
      snapshots.push(stateToSnapshot(state));
    }
  }

  return {
    seed: config.seed,
    score: [state.homeScore, state.awayScore],
    events: [...state.events],
    snapshots,
    finalState: state,
    winner: resolveWinner(state),
    ...(state.shootout ? { shootout: state.shootout } : {}),
  };
}

export function tickToMinute(tick: number): number {
  return tick / TICKS_PER_MINUTE;
}

export { LIVE_MATCH_MINUTES, LIVE_TOTAL_TICKS, TICKS_PER_MINUTE };
