import { describe, expect, it } from "vitest";
import {
  BALL_CUT_DISTANCE,
  interpolateFrame,
} from "../../src/render/liveInterpolate.js";
import type { LiveSnapshot } from "../../src/live/types.js";

function snap(
  tick: number,
  ball: { x: number; y: number },
  playerPos: { x: number; y: number },
  score: [number, number] = [0, 0],
): LiveSnapshot {
  return {
    tick,
    minute: tick / 10,
    score,
    ball,
    ballMode: "carried",
    possession: "home",
    players: [
      { id: "h1", side: "home", number: 9, pos: playerPos, hasBall: true },
    ],
  };
}

describe("live snapshot interpolation", () => {
  it("linearly interpolates player tokens between snapshots", () => {
    const a = snap(0, { x: 0, y: 0 }, { x: 0, y: 0 });
    const b = snap(2, { x: 0.1, y: 0.1 }, { x: 0.1, y: 0.2 });
    const mid = interpolateFrame(a, b, 0.5);
    const token = mid.tokens.find((t) => t.id === "h1")!;
    expect(token.position.x).toBeCloseTo(0.05, 6);
    expect(token.position.y).toBeCloseTo(0.1, 6);
  });

  it("interpolates the ball smoothly for small moves", () => {
    const a = snap(0, { x: 0.4, y: 0.5 }, { x: 0.4, y: 0.5 });
    const b = snap(2, { x: 0.46, y: 0.5 }, { x: 0.46, y: 0.5 });
    const mid = interpolateFrame(a, b, 0.5);
    expect(mid.ball.x).toBeCloseTo(0.43, 6);
  });

  it("cuts (does not slide) the ball across large discontinuities", () => {
    // e.g. a goal reset: ball jumps from the box to the centre circle.
    const a = snap(0, { x: 0.95, y: 0.5 }, { x: 0.9, y: 0.5 });
    const b = snap(2, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 });
    expect(BALL_CUT_DISTANCE).toBeLessThan(0.45);

    const early = interpolateFrame(a, b, 0.25);
    expect(early.ball.x).toBeCloseTo(0.95, 6); // still at the old spot

    const late = interpolateFrame(a, b, 0.75);
    expect(late.ball.x).toBeCloseTo(0.5, 6); // cut to the new spot, never 0.7-ish
  });

  it("takes discrete fields (score) from the target snapshot", () => {
    const a = snap(0, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, [0, 0]);
    const b = snap(2, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, [1, 0]);
    expect(interpolateFrame(a, b, 0.1).score).toEqual([1, 0]);
  });

  it("clamps t outside [0,1]", () => {
    const a = snap(0, { x: 0, y: 0 }, { x: 0, y: 0 });
    const b = snap(2, { x: 0.1, y: 0 }, { x: 0.2, y: 0 });
    const under = interpolateFrame(a, b, -1);
    const over = interpolateFrame(a, b, 2);
    expect(under.tokens[0]!.position.x).toBeCloseTo(0, 6);
    expect(over.tokens[0]!.position.x).toBeCloseTo(0.2, 6);
  });
});
