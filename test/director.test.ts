import { beforeEach, describe, expect, it } from "vitest";
import { simulateMatch, type TeamStrength } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import type { MatchTimeline } from "../src/types.js";
import { directFrame, reconcileScoreAtFt, resetDirectorPlayback } from "../src/render/director.js";
import { maxMatchMinute } from "../src/render/clock.js";

const STRONG: TeamStrength = { attack: 91, defense: 91, overall: 91 };
const WEAK: TeamStrength = { attack: 68, defense: 68, overall: 68 };

function build(seed: string, knockout = false): MatchTimeline {
  const result = simulateMatch({ home: STRONG, away: WEAK, seed, knockout });
  return generateTimeline({
    result,
    seed,
    scenario: { team: "Test", cup: 1970 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });
}

function inUnit(v: number): boolean {
  return v >= 0 && v <= 1;
}

describe("directFrame", () => {
  beforeEach(() => {
    resetDirectorPlayback();
  });

  it("reconciles FT score to timeline.result.score", () => {
    for (let i = 0; i < 50; i++) {
      const tl = build(`dir-ft-${i}`);
      expect(reconcileScoreAtFt(tl)).toBe(true);
      const ft = directFrame(tl, maxMatchMinute(tl));
      expect(ft.score).toEqual(tl.result.score);
    }
  });

  it("keeps ball coordinates in 0..1", () => {
    const tl = build("ball-bounds");
    const max = maxMatchMinute(tl);
    for (let step = 0; step <= 40; step++) {
      const t = (step / 40) * max;
      const frame = directFrame(tl, t);
      expect(inUnit(frame.ball.x)).toBe(true);
      expect(inUnit(frame.ball.y)).toBe(true);
      for (const tok of frame.tokens) {
        expect(inUnit(tok.position.x)).toBe(true);
        expect(inUnit(tok.position.y)).toBe(true);
      }
    }
  });

  it("renders 22 player tokens", () => {
    const tl = build("tokens");
    const frame = directFrame(tl, 45);
    expect(frame.tokens).toHaveLength(22);
    const home = frame.tokens.filter((t) => t.side === "home");
    const away = frame.tokens.filter((t) => t.side === "away");
    expect(home).toHaveLength(11);
    expect(away).toHaveLength(11);
  });

  it("is deterministic for the same timeline and minute", () => {
    const tl = build("det");
    const a = directFrame(tl, 33.5);
    const b = directFrame(tl, 33.5);
    expect(a).toEqual(b);
  });
});
