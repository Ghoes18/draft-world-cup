/**
 * Snapshot interpolation for the live player.
 *
 * The live sim emits one snapshot every N ticks. Rendering snapshots raw makes
 * the ball and players jump between frames. This blends two consecutive
 * snapshots into a single render frame so motion reads as continuous — while
 * still *cutting* (not sliding) the ball across genuine discontinuities like
 * kickoffs, goals, and set-piece placement.
 */

import type { LiveSnapshot } from "../live/types.js";
import { snapshotToFrame } from "../live/snapshots.js";
import type { FrameState } from "./types.js";
import { lerpVec } from "./motion.js";

/** Ball jumps larger than this are restarts/goals — cut instead of slide. */
export const BALL_CUT_DISTANCE = 0.18;

function distance(a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  return Math.sqrt(dx * dx + dy * dy);
}

/**
 * Blend snapshot `a` → `b` at fraction `t` (0..1). Player tokens always
 * interpolate; the ball cuts on large discontinuities. Discrete fields (score,
 * phase, banner, carrier) are taken from the target snapshot `b` so events
 * surface promptly.
 */
export function interpolateFrame(
  a: LiveSnapshot,
  b: LiveSnapshot,
  t: number,
): FrameState {
  const clamped = t < 0 ? 0 : t > 1 ? 1 : t;
  const frame = snapshotToFrame(b);

  const fromById = new Map(a.players.map((p) => [p.id, p.pos] as const));
  frame.tokens = frame.tokens.map((token) => {
    const fromPos = fromById.get(token.id);
    if (!fromPos) return token;
    return { ...token, position: lerpVec(fromPos, token.position, clamped) };
  });

  frame.ball =
    distance(a.ball, b.ball) > BALL_CUT_DISTANCE
      ? clamped < 0.5
        ? { ...a.ball }
        : { ...b.ball }
      : lerpVec(a.ball, b.ball, clamped);

  return frame;
}
