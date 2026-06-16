import { describe, expect, it, beforeEach } from "vitest";
import { simulateMatch, type TeamStrength } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import type { MatchEvent, MatchTimeline } from "../src/types.js";
import {
  directFrame,
  reconcileScoreAtFt,
  resetDirectorPlayback,
} from "../src/render/director.js";
import { maxMatchMinute } from "../src/render/clock.js";

const STRONG: TeamStrength = { attack: 91, defense: 91, overall: 91 };
const WEAK: TeamStrength = { attack: 68, defense: 68, overall: 68 };

function build(seed: string): MatchTimeline {
  const result = simulateMatch({ home: STRONG, away: WEAK, seed });
  return generateTimeline({
    result,
    seed,
    scenario: { team: "Test", cup: 1970 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });
}

function dist(a: { x: number; y: number }, b: { x: number; y: number }): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Goals should be preceded by a linked possession buildup on the same team. */
function goalHasBuildup(
  events: MatchEvent[],
  goal: Extract<MatchEvent, { type: "goal" }>,
): boolean {
  return events.some((e) => {
    if (e.type !== "possession" || e.team !== goal.team) return false;
    const gap = goal.t - e.t;
    if (gap < 0.5 || gap > 2) return false;
    const lastHop = e.passes[e.passes.length - 1];
    if (!lastHop) return false;
    return dist(lastHop.ball, goal.from) < 0.25;
  });
}

describe("timeline attack clusters", () => {
  it("links every goal to a preceding possession buildup", () => {
    for (let i = 0; i < 30; i++) {
      const tl = build(`cluster-goal-${i}`);
      const goals = tl.events.filter((e): e is Extract<MatchEvent, { type: "goal" }> => e.type === "goal");
      for (const g of goals) {
        expect(goalHasBuildup(tl.events, g)).toBe(true);
      }
    }
  });

  it("links non-goal shots to a preceding possession on the same team", () => {
    const tl = build("cluster-shots");
    const shots = tl.events.filter(
      (e): e is Extract<MatchEvent, { type: "shot" }> => e.type === "shot",
    );
    expect(shots.length).toBeGreaterThan(0);
    let linked = 0;
    for (const shot of shots) {
      const poss = tl.events.find(
        (e) =>
          e.type === "possession" &&
          e.team === shot.team &&
          e.t < shot.t &&
          shot.t - e.t < 2,
      );
      if (poss?.type === "possession" && poss.passes.length > 0) {
        const last = poss.passes[poss.passes.length - 1]!.ball;
        if (dist(last, shot.from) < 0.25) linked++;
      }
    }
    expect(linked / shots.length).toBeGreaterThan(0.8);
  });
});

describe("director ball continuity", () => {
  beforeEach(() => {
    resetDirectorPlayback();
  });

  it("does not park the ball at center during open play", () => {
    const tl = build("no-center-idle");
    const max = maxMatchMinute(tl);
    let centerSnaps = 0;
    let samples = 0;
    for (let step = 1; step < 200; step++) {
      const t = (step / 200) * max;
      if (t < 1) continue;
      const frame = directFrame(tl, t);
      if (frame.phase === "open") {
        samples++;
        if (dist(frame.ball, { x: 0.5, y: 0.5 }) < 0.02) centerSnaps++;
      }
    }
    expect(samples).toBeGreaterThan(0);
    expect(centerSnaps / samples).toBeLessThan(0.05);
  });

  it("limits ball teleport between adjacent animation samples", () => {
    const tl = build("teleport-check");
    const max = maxMatchMinute(tl);
    const dt = max / 400;
    let maxJump = 0;
    let prev = directFrame(tl, 0.5).ball;
    for (let t = 0.5 + dt; t < max; t += dt) {
      const frame = directFrame(tl, t);
      maxJump = Math.max(maxJump, dist(prev, frame.ball));
      prev = frame.ball;
    }
    expect(maxJump).toBeLessThan(0.35);
  });

  it("highlights a ball carrier during possession", () => {
    const tl = build("carrier");
    const poss = tl.events.find((e) => e.type === "possession" && e.passes.length >= 2);
    expect(poss).toBeDefined();
    if (!poss || poss.type !== "possession") return;
    const mid = poss.t + 0.3;
    const frame = directFrame(tl, mid);
    expect(frame.phase).toBe("possession");
    const carriers = frame.tokens.filter((t) => t.hasBall);
    expect(carriers.length).toBe(1);
  });

  it("still reconciles FT score after continuity changes", () => {
    for (let i = 0; i < 50; i++) {
      const tl = build(`ft-${i}`);
      expect(reconcileScoreAtFt(tl)).toBe(true);
    }
  });
});
