/**
 * Director — pure timeline + match minute → FrameState.
 *
 * No canvas, no wall-clock. Choreography derives corner/penalty coords from
 * goal geometry so we never touch the timeline schema.
 */

import type {
  LineupSlot,
  MatchEvent,
  MatchTimeline,
  PassHop,
  Side,
  Vec2,
} from "../types.js";
import {
  ARC_LIFT,
  BEAT_DURATION_MIN,
  BLOCK_SHIFT_X,
  BLOCK_SHIFT_Y,
  CORNER_INSET,
  PENALTY_SPOT_X,
  SHOOTOUT_SPOT_AWAY,
  SHOOTOUT_SPOT_HOME,
} from "./constants.js";
import {
  clampVec,
  easeInOut,
  idleNoise,
  lerpVec,
  quadraticBezier,
} from "./motion.js";
import type { ChoreoPhase, FrameState, TokenState } from "./types.js";
import { maxMatchMinute } from "./clock.js";

const CENTER: Vec2 = { x: 0.5, y: 0.5 };

/** Max normalized ball travel per director sample (anti-teleport for playback). */
const MAX_BALL_STEP = 0.12;

let lastSample: { t: number; ball: Vec2 } | null = null;

function clampBallStep(matchTimeMin: number, ball: Vec2): Vec2 {
  if (!lastSample || matchTimeMin <= lastSample.t) {
    lastSample = { t: matchTimeMin, ball };
    return ball;
  }
  const dt = matchTimeMin - lastSample.t;
  if (dt > 2) {
    lastSample = { t: matchTimeMin, ball };
    return ball;
  }
  const d = Math.hypot(ball.x - lastSample.ball.x, ball.y - lastSample.ball.y);
  if (d > MAX_BALL_STEP) {
    const ratio = MAX_BALL_STEP / d;
    ball = lerpVec(lastSample.ball, ball, ratio);
  }
  lastSample = { t: matchTimeMin, ball };
  return ball;
}

/** Reset playback smoothing (tests / new timeline). */
export function resetDirectorPlayback(): void {
  lastSample = null;
}

interface ActiveBeat {
  event: MatchEvent;
  progress: number; // 0..1 within the beat window
  priority: number;
}

interface BallState {
  ball: Vec2;
  carrierId?: string;
}

function goalMouth(side: Side): Vec2 {
  return side === "home" ? { x: 0.98, y: 0.5 } : { x: 0.02, y: 0.5 };
}

function penaltySpot(side: Side): Vec2 {
  return side === "home"
    ? { x: 1 - PENALTY_SPOT_X, y: 0.5 }
    : { x: PENALTY_SPOT_X, y: 0.5 };
}

function cornerFlag(team: Side, corner: "L" | "R"): Vec2 {
  const gx = team === "home" ? 1 - CORNER_INSET : CORNER_INSET;
  const gy = corner === "L" ? CORNER_INSET : 1 - CORNER_INSET;
  return { x: gx, y: gy };
}

function anchorOf(
  playerId: string,
  lineups: Record<Side, LineupSlot[]>,
): Vec2 | null {
  for (const side of ["home", "away"] as const) {
    const slot = lineups[side].find((s) => s.playerId === playerId);
    if (slot) return slot.anchor;
  }
  return null;
}

function eventPriority(e: MatchEvent): number {
  switch (e.type) {
    case "goal":
      return 70;
    case "shootout":
      return 65;
    case "penalty":
      return 60;
    case "fulltime":
      return 55;
    case "shot":
      return 40;
    case "corner":
      return 35;
    case "freekick":
      return 35;
    case "possession":
      return 20;
    case "kickoff":
      return 10;
  }
}

export function beatWindow(e: MatchEvent): number {
  if (e.type === "possession") return BEAT_DURATION_MIN * 0.9;
  if (e.type === "shootout") return BEAT_DURATION_MIN * 3;
  if (e.type === "goal") return BEAT_DURATION_MIN * 1.6;
  return BEAT_DURATION_MIN;
}

function findNextBeat(events: MatchEvent[], matchTimeMin: number): MatchEvent | null {
  let next: MatchEvent | null = null;
  for (const e of events) {
    if (e.type === "fulltime") continue;
    if (e.t <= matchTimeMin) continue;
    if (!next || e.t < next.t) next = e;
  }
  return next;
}

/** Ball position at the start of an event (progress = 0). */
function eventStartBall(
  e: MatchEvent,
  lineups: Record<Side, LineupSlot[]>,
  settled: BallState,
): BallState {
  switch (e.type) {
    case "kickoff":
      return { ball: CENTER };
    case "possession": {
      const first = e.passes[0];
      if (!first) return settled;
      const anchor = anchorOf(first.fromId, lineups);
      return { ball: anchor ?? settled.ball, carrierId: first.fromId };
    }
    case "shot":
      return { ball: e.from };
    case "corner":
      return settled;
    case "freekick":
      return { ball: e.from };
    case "penalty":
      return { ball: penaltySpot(e.team) };
    case "goal":
      return { ball: e.from, carrierId: e.scorerId };
    case "shootout":
      return { ball: CENTER };
    case "fulltime":
      return { ball: CENTER };
  }
}

/** Blend toward the next beat during short gaps so the ball eases in. */
function blendTowardNext(
  events: MatchEvent[],
  lineups: Record<Side, LineupSlot[]>,
  matchTimeMin: number,
  settled: BallState,
): BallState {
  const next = findNextBeat(events, matchTimeMin);
  if (!next) return settled;
  const gap = next.t - matchTimeMin;
  const blendWindow = 0.6;
  if (gap <= 0 || gap > blendWindow) return settled;
  const target = eventStartBall(next, lineups, settled);
  const blend = easeInOut(1 - gap / blendWindow);
  const carrierId =
    blend > 0.5 ? target.carrierId : settled.carrierId;
  return {
    ball: lerpVec(settled.ball, target.ball, blend),
    ...(carrierId !== undefined ? { carrierId } : {}),
  };
}

function findActiveBeat(
  events: MatchEvent[],
  matchTimeMin: number,
): ActiveBeat | null {
  let best: ActiveBeat | null = null;
  for (const e of events) {
    if (e.type === "fulltime") continue;
    const dur = beatWindow(e);
    if (matchTimeMin < e.t || matchTimeMin >= e.t + dur) continue;
    const progress = (matchTimeMin - e.t) / dur;
    const priority = eventPriority(e);
    if (!best || priority > best.priority) {
      best = { event: e, progress, priority };
    }
  }
  return best;
}

function scoreAtTime(events: MatchEvent[], matchTimeMin: number): [number, number] {
  let home = 0;
  let away = 0;
  for (const e of events) {
    if (e.type !== "goal" || e.t > matchTimeMin) continue;
    if (e.team === "home") home++;
    else away++;
  }
  return [home, away];
}

/** Ball + carrier at the end of a completed event. */
function ballAtEventEnd(
  e: MatchEvent,
  lineups: Record<Side, LineupSlot[]>,
): BallState {
  switch (e.type) {
    case "kickoff":
      return { ball: { x: 0.52, y: 0.5 } };
    case "possession": {
      const last = e.passes[e.passes.length - 1];
      if (!last) return { ball: CENTER };
      return { ball: last.ball, carrierId: last.toId };
    }
    case "shot":
      return { ball: goalMouth(e.team) };
    case "corner":
      return { ball: goalMouth(e.team) };
    case "freekick":
      return { ball: e.from };
    case "penalty":
      return { ball: penaltySpot(e.team) };
    case "goal":
      return { ball: goalMouth(e.team), carrierId: e.scorerId };
    case "shootout":
      return { ball: CENTER };
    case "fulltime":
      return { ball: CENTER };
  }
}

/** Last settled ball position before `matchTimeMin` (between dramatic beats). */
export function settledBall(
  events: MatchEvent[],
  lineups: Record<Side, LineupSlot[]>,
  matchTimeMin: number,
): BallState {
  let state: BallState = { ball: CENTER };

  for (const e of events) {
    if (e.type === "fulltime") continue;
    const endT = e.t + beatWindow(e);
    if (endT > matchTimeMin) continue;
    state = ballAtEventEnd(e, lineups);
  }

  return state;
}

function ballAlongPasses(
  passes: PassHop[],
  t: number,
  lineups: Record<Side, LineupSlot[]>,
): BallState {
  if (passes.length === 0) return { ball: CENTER };

  const seg = t * passes.length;
  const idx = Math.min(passes.length - 1, Math.floor(seg));
  const local = seg - idx;
  const hop = passes[idx]!;
  const toPos = hop.ball;
  const fromPos =
    anchorOf(hop.fromId, lineups) ??
    (idx > 0 ? passes[idx - 1]!.ball : toPos);
  const eased = easeInOut(local);
  const ball = lerpVec(fromPos, toPos, eased);
  const carrierId = eased > 0.55 ? hop.toId : hop.fromId;
  return { ball, carrierId };
}

function choreographBall(
  beat: ActiveBeat | null,
  fallback: BallState,
  lineups: Record<Side, LineupSlot[]>,
): { ball: Vec2; phase: ChoreoPhase; banner?: string; carrierId?: string } {
  if (!beat) {
    return {
      ball: fallback.ball,
      phase: "open",
      ...(fallback.carrierId !== undefined ? { carrierId: fallback.carrierId } : {}),
    };
  }

  const { event: e, progress: p } = beat;

  switch (e.type) {
    case "kickoff":
      return {
        ball: lerpVec(CENTER, { x: 0.52, y: 0.5 }, easeInOut(p)),
        phase: "open",
      };

    case "possession": {
      const intro = 0.1;
      if (p < intro && e.passes.length > 0) {
        const first = e.passes[0]!;
        const fromAnchor =
          anchorOf(first.fromId, lineups) ?? fallback.ball;
        const ball = lerpVec(fallback.ball, fromAnchor, easeInOut(p / intro));
        return {
          ball,
          phase: "possession",
          carrierId: first.fromId,
        };
      }
      const local = intro < 1 ? (p - intro) / (1 - intro) : p;
      const { ball, carrierId } = ballAlongPasses(
        e.passes,
        easeInOut(Math.max(0, local)),
        lineups,
      );
      return {
        ball,
        phase: "possession",
        ...(carrierId !== undefined ? { carrierId } : {}),
      };
    }

    case "shot": {
      const target = goalMouth(e.team);
      const ball = quadraticBezier(e.from, target, p, ARC_LIFT);
      return { ball, phase: "shot" };
    }

    case "corner": {
      const flag = cornerFlag(e.team, e.side);
      const target = goalMouth(e.team);
      const runUp = 0.22;
      if (p < runUp) {
        const ball = lerpVec(fallback.ball, flag, easeInOut(p / runUp));
        return { ball, phase: "corner" };
      }
      const ball = quadraticBezier(
        flag,
        target,
        (p - runUp) / (1 - runUp),
        ARC_LIFT * 0.8,
      );
      return { ball, phase: "corner" };
    }

    case "freekick": {
      const target = goalMouth(e.team);
      const ball = quadraticBezier(e.from, target, p, ARC_LIFT);
      return { ball, phase: "freekick" };
    }

    case "penalty": {
      const spot = penaltySpot(e.team);
      const target = goalMouth(e.team);
      if (p < 0.35) return { ball: spot, phase: "penalty" };
      const kickT = (p - 0.35) / 0.65;
      const ball = quadraticBezier(spot, target, kickT, ARC_LIFT * 0.5);
      const out: {
        ball: Vec2;
        phase: ChoreoPhase;
        banner?: string;
        carrierId?: string;
      } = { ball, phase: "penalty" };
      if (p > 0.7) out.banner = e.outcome.toUpperCase();
      return out;
    }

    case "goal": {
      const target = goalMouth(e.team);
      if (p < 0.55) {
        const ball = quadraticBezier(e.from, target, p / 0.55, ARC_LIFT);
        const out: {
          ball: Vec2;
          phase: ChoreoPhase;
          banner?: string;
          carrierId?: string;
        } = { ball, phase: "goal", carrierId: e.scorerId };
        if (p > 0.35) out.banner = "GOAL!";
        return out;
      }
      const celeb = (p - 0.55) / 0.45;
      const cluster = lerpVec(target, e.from, 0.35 * (1 - celeb));
      return {
        ball: cluster,
        phase: "celebration",
        banner: "GOAL!",
        carrierId: e.scorerId,
      };
    }

    case "shootout": {
      const kickFloat = p * e.kicks.length;
      const kickIdx = Math.min(e.kicks.length - 1, Math.floor(kickFloat));
      const kick = e.kicks[kickIdx];
      const team = kick?.team ?? "home";
      const spot =
        team === "home"
          ? { x: SHOOTOUT_SPOT_HOME, y: 0.5 }
          : { x: SHOOTOUT_SPOT_AWAY, y: 0.5 };
      const localP = kickFloat - kickIdx;
      const target = goalMouth(team);
      if (localP < 0.2) {
        const from =
          kickIdx > 0
            ? goalMouth(e.kicks[kickIdx - 1]!.team)
            : fallback.ball;
        const ball = lerpVec(from, spot, easeInOut(localP / 0.2));
        return { ball, phase: "shootout" };
      }
      if (localP < 0.45) return { ball: spot, phase: "shootout" };
      const ball = quadraticBezier(
        spot,
        target,
        (localP - 0.45) / 0.55,
        ARC_LIFT * 0.4,
      );
      return { ball, phase: "shootout", banner: "PENALTIES" };
    }

    case "fulltime":
      return { ball: CENTER, phase: "fulltime", banner: "FT" };
  }
}

function tokenPosition(
  slot: LineupSlot,
  side: Side,
  ball: Vec2,
  matchTimeMin: number,
  seed: string,
  phase: ChoreoPhase,
  beat: ActiveBeat | null,
): Vec2 {
  let anchor = { ...slot.anchor };

  if (phase === "celebration" && beat?.event.type === "goal") {
    const team = beat.event.team;
    if (slot.playerId.startsWith(`${team}-`)) {
      const pull = 0.25 * beat.progress;
      anchor = lerpVec(anchor, ball, pull);
    }
  }

  if (phase === "shootout") {
    if (slot.position === "GK") {
      anchor = side === "home" ? { x: 0.92, y: 0.5 } : { x: 0.08, y: 0.5 };
    } else {
      anchor = { x: 0.5, y: anchor.y };
    }
  }

  const shiftX = (ball.x - 0.5) * BLOCK_SHIFT_X;
  const shiftY = (ball.y - 0.5) * BLOCK_SHIFT_Y;
  const noise = idleNoise(slot.playerId, matchTimeMin, seed);

  return clampVec({
    x: anchor.x + shiftX + noise.x,
    y: anchor.y + shiftY + noise.y,
  });
}

function buildTokens(
  lineups: Record<Side, LineupSlot[]>,
  ball: Vec2,
  matchTimeMin: number,
  seed: string,
  phase: ChoreoPhase,
  beat: ActiveBeat | null,
  carrierId?: string,
): TokenState[] {
  const tokens: TokenState[] = [];
  for (const side of ["home", "away"] as const) {
    for (const slot of lineups[side]) {
      const hasBall = carrierId !== undefined && slot.playerId === carrierId;
      tokens.push({
        id: slot.playerId,
        side,
        number: slot.number,
        position: tokenPosition(
          slot,
          side,
          ball,
          matchTimeMin,
          seed,
          phase,
          beat,
        ),
        ...(hasBall ? { hasBall: true } : {}),
      });
    }
  }
  return tokens;
}

/** Produce a FrameState for the given match minute. */
export function directFrame(
  timeline: MatchTimeline,
  matchTimeMin: number,
): FrameState {
  const t = Math.max(0, Math.min(maxMatchMinute(timeline), matchTimeMin));
  const beat = findActiveBeat(timeline.events, t);
  let fallback = settledBall(timeline.events, timeline.lineups, t);
  if (!beat) {
    fallback = blendTowardNext(
      timeline.events,
      timeline.lineups,
      t,
      fallback,
    );
  }

  const {
    ball: rawBall,
    phase,
    banner,
    carrierId,
  } = choreographBall(beat, fallback, timeline.lineups);
  const ball = clampBallStep(t, clampVec(rawBall));

  let score = scoreAtTime(timeline.events, t);
  let finalBanner = banner;

  const ft = timeline.events.find((e) => e.type === "fulltime");
  const ftMin = ft?.t ?? maxMatchMinute(timeline);
  if (t >= ftMin && ft?.type === "fulltime") {
    score = ft.score;
    if (!finalBanner && t >= ftMin) finalBanner = "FT";
  }

  const tokens = buildTokens(
    timeline.lineups,
    ball,
    t,
    timeline.seed,
    phase,
    beat,
    carrierId,
  );

  const frame: FrameState = {
    matchTimeMin: t,
    score,
    ball,
    tokens,
    phase: t >= ftMin ? (phase === "shootout" ? "shootout" : "fulltime") : phase,
    ...(carrierId !== undefined ? { carrierId } : {}),
  };
  if (finalBanner !== undefined) frame.banner = finalBanner;
  return frame;
}

/** At full time the displayed score must equal timeline.result.score. */
export function reconcileScoreAtFt(timeline: MatchTimeline): boolean {
  const ft = maxMatchMinute(timeline);
  const frame = directFrame(timeline, ft);
  return (
    frame.score[0] === timeline.result.score[0] &&
    frame.score[1] === timeline.result.score[1]
  );
}
