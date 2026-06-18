import type { Side, Vec2 } from "../types.js";
import type { Rng } from "../rng.js";
import { pick } from "../rng.js";
import { tacticBias } from "./attributes.js";
import {
  PASS_MAX_RANGE,
  SHOOT_RANGE,
  TACKLE_RANGE,
  CROSS_MIN_FORWARD,
  CROSS_TOUCHLINE_Y,
  BOX_DEPTH,
  BOX_HALF_WIDTH,
} from "./constants.js";
import {
  attackDir,
  dist,
  nearestDefender,
  openness,
  opponentGoalX,
  passSuccessChance,
} from "./outcomes.js";
import {
  buildPlayerIntents,
  getTeamPhase,
  intentMovementTarget,
  type TickPlan,
} from "./phase.js";
import type { LiveAction, LiveMatchState, LivePlayer, LiveTactic } from "./types.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function teammates(state: LiveMatchState, side: Side): LivePlayer[] {
  return state.players.filter((p) => p.side === side && !p.isGoalkeeper);
}

function defenders(state: LiveMatchState, side: Side): LivePlayer[] {
  const opp: Side = side === "home" ? "away" : "home";
  return state.players.filter((p) => p.side === opp && !p.isGoalkeeper);
}

function carrier(state: LiveMatchState): LivePlayer | null {
  const id = state.ball.ownerId;
  if (!id) return null;
  return state.players.find((p) => p.id === id) ?? null;
}

function playerById(state: LiveMatchState, id: string): LivePlayer | undefined {
  return state.players.find((p) => p.id === id);
}

function nearestChaser(state: LiveMatchState): LivePlayer | null {
  const ball = state.ball.pos;
  let best: LivePlayer | null = null;
  let bestD = Infinity;
  for (const p of state.players) {
    if (p.isGoalkeeper) continue;
    const d = dist(p.pos, ball);
    if (d < bestD) {
      bestD = d;
      best = p;
    }
  }
  return best;
}

function findKickoffMate(state: LiveMatchState, side: Side): LivePlayer | null {
  return (
    state.players.find((p) => p.side === side && p.position === "ST" && !p.isGoalkeeper) ??
    state.players.find((p) => p.side === side && !p.isGoalkeeper) ??
    null
  );
}

function forwardProgress(pos: Vec2, side: Side): number {
  return side === "home" ? pos.x : 1 - pos.x;
}

function normalize(v: Vec2): Vec2 {
  const len = Math.sqrt(v.x * v.x + v.y * v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

/** Score pass targets for the carrier. */
function rankPassTargets(
  state: LiveMatchState,
  carrierPlayer: LivePlayer,
  tactic: LiveTactic,
  through: boolean,
): Array<{ id: string; score: number }> {
  const bias = tacticBias(tactic);
  const mates = teammates(state, carrierPlayer.side);
  const defs = defenders(state, carrierPlayer.side);
  const ranked: Array<{ id: string; score: number }> = [];

  for (const m of mates) {
    if (m.id === carrierPlayer.id) continue;
    const d = dist(carrierPlayer.pos, m.pos);
    if (d > PASS_MAX_RANGE) continue;
    const open = openness(m, defs);
    const forward = forwardProgress(m.pos, carrierPlayer.side);
    const chance = passSuccessChance({
      passer: carrierPlayer,
      receiver: m,
      defenders: defs,
      throughBall: through,
      teamOverall: state.teamOveralls[carrierPlayer.side],
      oppTeamOverall: state.teamOveralls[carrierPlayer.side === "home" ? "away" : "home"],
    });
    let score = chance * 2 + open * 1.2 + forward * bias.passForward;
    if (through) score += forward * 0.5;
    ranked.push({ id: m.id, score });
  }

  ranked.sort((a, b) => b.score - a.score);
  return ranked;
}

function isWideCarrier(player: LivePlayer): boolean {
  return player.pos.y < CROSS_TOUCHLINE_Y || player.pos.y > 1 - CROSS_TOUCHLINE_Y;
}

/** Carrier parked in the corner-flag zone — should deliver a cross, not dribble. */
function inCornerZone(player: LivePlayer): boolean {
  return (
    forwardProgress(player.pos, player.side) > 0.9 &&
    (player.pos.y < 0.06 || player.pos.y > 0.94)
  );
}

function isInAttackingBox(player: LivePlayer): boolean {
  if (player.side === "home") {
    return (
      player.pos.x >= 1 - BOX_DEPTH &&
      player.pos.y >= 0.5 - BOX_HALF_WIDTH &&
      player.pos.y <= 0.5 + BOX_HALF_WIDTH
    );
  }
  return (
    player.pos.x <= BOX_DEPTH &&
    player.pos.y >= 0.5 - BOX_HALF_WIDTH &&
    player.pos.y <= 0.5 + BOX_HALF_WIDTH
  );
}

function findCrossTarget(
  state: LiveMatchState,
  carrierPlayer: LivePlayer,
): LivePlayer | null {
  const mates = teammates(state, carrierPlayer.side).filter(
    (m) => m.id !== carrierPlayer.id && isInAttackingBox(m),
  );
  if (mates.length === 0) return null;
  mates.sort(
    (a, b) =>
      dist(carrierPlayer.pos, a.pos) - dist(carrierPlayer.pos, b.pos),
  );
  return mates[0] ?? null;
}

function chooseCrossAction(
  state: LiveMatchState,
  player: LivePlayer,
  tactic: LiveTactic,
  rng: Rng,
): LiveAction | null {
  if (!isWideCarrier(player)) return null;
  if (forwardProgress(player.pos, player.side) < CROSS_MIN_FORWARD) return null;
  const target = findCrossTarget(state, player);
  if (!target) return null;
  // A corner taker at the flag whips it in without hesitation.
  if (inCornerZone(player)) return { kind: "cross", targetZone: { ...target.pos } };
  const bias = tacticBias(tactic);
  if (rng() > 0.38 * bias.passForward + 0.12) return null;
  return { kind: "cross", targetZone: { ...target.pos } };
}

function chooseAttackAction(
  state: LiveMatchState,
  player: LivePlayer,
  tactic: LiveTactic,
  rng: Rng,
): LiveAction {
  const cross = chooseCrossAction(state, player, tactic, rng);
  if (cross) return cross;

  const bias = tacticBias(tactic);
  const defs = defenders(state, player.side);
  const goalX = opponentGoalX(player.side);
  const toGoal = dist(player.pos, { x: goalX, y: 0.5 });
  const nearest = nearestDefender(player.pos, defs);
  const pressure = nearest ? clamp(1 - dist(player.pos, nearest.pos) / 0.2, 0, 1) : 0;

  if (toGoal < SHOOT_RANGE && rng() < 0.62 * bias.shoot + (SHOOT_RANGE - toGoal) * 1.1) {
    return { kind: "shoot" };
  }

  const passTargets = rankPassTargets(state, player, tactic, false);
  const throughTargets = rankPassTargets(state, player, tactic, true);

  if (passTargets.length > 0 && rng() < 0.58 + pressure * -0.12) {
    const top = passTargets.slice(0, 3);
    const chosen = pick(rng, top);
    if (
      throughTargets[0] &&
      throughTargets[0].score > chosen.score * 1.08 &&
      rng() < 0.3 * bias.passForward
    ) {
      return { kind: "through", targetId: throughTargets[0].id };
    }
    return { kind: "pass", targetId: chosen.id };
  }

  if (rng() < 0.42 * bias.dribble) {
    const dir = attackDir(player.side);
    const lateral = (rng() - 0.5) * 0.5;
    return {
      kind: "dribble",
      direction: normalize({ x: dir.x, y: dir.y + lateral }),
    };
  }

  return {
    kind: "carry",
    direction: normalize(attackDir(player.side)),
  };
}

function nearestDefenderToBall(
  state: LiveMatchState,
  defendingSide: Side,
): LivePlayer | null {
  const defPool = state.players.filter(
    (p) => p.side === defendingSide && !p.isGoalkeeper,
  );
  let actor: LivePlayer | null = null;
  let bestD = Infinity;
  for (const d of defPool) {
    const dd = dist(d.pos, state.ball.pos);
    if (dd < bestD) {
      bestD = dd;
      actor = d;
    }
  }
  return actor;
}

function chooseDefendAction(
  state: LiveMatchState,
  defender: LivePlayer,
  tactic: LiveTactic,
  rng: Rng,
): LiveAction {
  const bias = tacticBias(tactic);
  const ball = state.ball.pos;
  const oppCarrier = carrier(state);

  if (state.ball.mode === "loose" || state.ball.mode === "cross") {
    return { kind: "recover" };
  }

  if (!oppCarrier || oppCarrier.side === defender.side) {
    return { kind: "recover" };
  }

  const dToCarrier = dist(defender.pos, oppCarrier.pos);
  const dToBall = dist(defender.pos, ball);

  if (dToCarrier < TACKLE_RANGE && rng() < 0.48 * bias.press) {
    return { kind: "tackle", targetId: oppCarrier.id };
  }

  if (state.ball.mode === "pass" && dToBall < 0.14 && rng() < 0.42) {
    return { kind: "intercept" };
  }

  if (dToCarrier < 0.2 && rng() < 0.55 * bias.press) {
    return { kind: "press", targetId: oppCarrier.id };
  }

  return { kind: "recover" };
}

function chooseKeeperAction(
  state: LiveMatchState,
  gk: LivePlayer,
  rng: Rng,
): LiveAction {
  if (state.ball.ownerId === gk.id && state.ball.mode === "carried") {
    const mates = teammates(state, gk.side);
    const options = mates
      .map((m) => ({
        id: m.id,
        score:
          forwardProgress(m.pos, gk.side) +
          openness(m, defenders(state, gk.side)),
      }))
      .sort((a, b) => b.score - a.score);
    if (options.length > 0 && rng() < 0.18) {
      return { kind: "pass", targetId: options[0]!.id };
    }
  }
  return { kind: "hold" };
}

/** Pick carrier action and per-player intents for this tick. */
export function decideTickPlan(
  state: LiveMatchState,
  tactics: Record<Side, LiveTactic>,
  rng: Rng,
): TickPlan {
  const phase = getTeamPhase(state);
  const c = carrier(state);

  if (c?.isGoalkeeper) {
    const action = chooseKeeperAction(state, c, rng);
    return {
      phase,
      carrierAction: action,
      actorId: c.id,
      intents: buildPlayerIntents(state, action, c.id, rng),
    };
  }

  if (state.ball.mode === "loose" || state.ball.mode === "cross") {
    const actor = nearestChaser(state);
    return {
      phase,
      carrierAction: { kind: "recover" },
      actorId: actor?.id ?? null,
      intents: buildPlayerIntents(state, { kind: "recover" }, actor?.id ?? null, rng),
    };
  }

  if (state.setPiece !== null && state.ball.mode === "dead") {
    const taker = playerById(state, state.setPiece.takerId);
    const action: LiveAction = state.setPiece.kind === "penalty"
      ? { kind: "shoot" }
      : rng() < 0.35
        ? { kind: "shoot" }
        : { kind: "pass", targetId: findKickoffMate(state, state.setPiece.side)?.id ?? "" };
    return {
      phase,
      carrierAction: action,
      actorId: taker?.id ?? null,
      intents: buildPlayerIntents(state, action, taker?.id ?? null, rng),
    };
  }

  if (c && c.side === state.possession && state.ball.mode === "carried") {
    // Re-evaluate options every third tick — a short dwell reads as the carrier
    // driving forward, but without the old %4 "march straight at goal" monotony
    // (and shot volume stays up). A carrier parked in the corner zone always
    // evaluates so it actually whips the corner in.
    const action =
      state.tick % 3 === 0 || inCornerZone(c)
        ? chooseAttackAction(state, c, tactics[c.side], rng)
        : { kind: "carry" as const, direction: normalize(attackDir(c.side)) };
    return {
      phase,
      carrierAction: action,
      actorId: c.id,
      intents: buildPlayerIntents(state, action, c.id, rng),
    };
  }

  const defendingSide: Side =
    state.possession === "home" ? "away" : "home";
  const actor = nearestDefenderToBall(state, defendingSide);
  const action = actor
    ? chooseDefendAction(state, actor, tactics[defendingSide], rng)
    : { kind: "recover" as const };
  return {
    phase,
    carrierAction: action,
    actorId: actor?.id ?? null,
    intents: buildPlayerIntents(state, action, actor?.id ?? null, rng),
  };
}

/** @deprecated Use decideTickPlan — kept for tests importing movementTarget. */
export function decideTickAction(
  state: LiveMatchState,
  tactics: Record<Side, LiveTactic>,
  rng: Rng,
): LiveAction {
  return decideTickPlan(state, tactics, rng).carrierAction;
}

/** Movement target for a player from tick plan intents. */
export function movementTargetFromPlan(
  player: LivePlayer,
  plan: TickPlan,
  state: LiveMatchState,
  actorAction: LiveAction | null,
): Vec2 {
  if (actorAction?.kind === "press" && actorAction.targetId && player.id !== plan.actorId) {
    const t = state.players.find((p) => p.id === actorAction.targetId);
    if (t) return t.pos;
  }
  if (actorAction?.kind === "tackle" && actorAction.targetId && player.id === plan.actorId) {
    const t = state.players.find((p) => p.id === actorAction.targetId);
    if (t) return t.pos;
  }
  if (actorAction?.kind === "intercept" && player.id === plan.actorId) {
    return state.ball.pos;
  }

  const intent = plan.intents.get(player.id);
  if (intent) {
    return intentMovementTarget(player, intent, state);
  }

  return player.anchor;
}

/** Legacy movement helper. */
export function movementTarget(
  player: LivePlayer,
  state: LiveMatchState,
  action: LiveAction | null,
): Vec2 {
  const ball = state.ball.pos;
  const c = state.ball.ownerId
    ? state.players.find((p) => p.id === state.ball.ownerId)
    : null;

  if (action?.kind === "press" && action.targetId) {
    const t = state.players.find((p) => p.id === action.targetId);
    if (t) return t.pos;
  }
  if (action?.kind === "tackle" && action.targetId) {
    const t = state.players.find((p) => p.id === action.targetId);
    if (t) return t.pos;
  }
  if (action?.kind === "intercept") return ball;

  if (c && c.side !== player.side && !player.isGoalkeeper) {
    return {
      x: ball.x * 0.55 + player.anchor.x * 0.45,
      y: ball.y * 0.55 + player.anchor.y * 0.45,
    };
  }

  if (c && c.side === player.side && player.id !== c.id) {
    const dir = attackDir(player.side);
    return {
      x: clamp(ball.x + dir.x * 0.08, 0.02, 0.98),
      y: clamp(ball.y + (player.anchor.y - 0.5) * 0.15, 0.05, 0.95),
    };
  }

  if (player.isGoalkeeper) {
    return {
      x: player.side === "home" ? 0.05 : 0.95,
      y: clamp(ball.y * 0.35 + 0.5 * 0.65, 0.42, 0.58),
    };
  }

  return player.anchor;
}
