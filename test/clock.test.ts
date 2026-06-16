import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { simulateMatch, type TeamStrength } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import { MatchClock, maxMatchMinute } from "../src/render/clock.js";
import { RATE_FAST, RATE_NORMAL } from "../src/render/constants.js";

const STRONG: TeamStrength = { attack: 85, defense: 85, overall: 85 };
const WEAK: TeamStrength = { attack: 70, defense: 70, overall: 70 };

function buildTimeline() {
  const seed = "clock-test";
  const result = simulateMatch({ home: STRONG, away: WEAK, seed });
  return generateTimeline({
    result,
    seed,
    scenario: { team: "Test", cup: 1970 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });
}

describe("MatchClock", () => {
  beforeEach(() => {
    vi.spyOn(performance, "now").mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("maps wall time to match minutes proportionally", () => {
    const tl = buildTimeline();
    const max = maxMatchMinute(tl);
    const clock = new MatchClock(tl, { rate: RATE_NORMAL });
    clock.play();

    vi.mocked(performance.now).mockReturnValue(tl.durationMs / 2);
    const mid = clock.tick(performance.now());
    expect(mid).toBeCloseTo(max / 2, 1);

    vi.mocked(performance.now).mockReturnValue(tl.durationMs);
    const end = clock.tick(performance.now());
    expect(end).toBe(max);
    expect(clock.playbackState).toBe("ended");
  });

  it("skipToEnd jumps to max minute", () => {
    const tl = buildTimeline();
    const clock = new MatchClock(tl);
    clock.skipToEnd();
    expect(clock.matchMinute).toBe(maxMatchMinute(tl));
    expect(clock.playbackState).toBe("ended");
  });

  it("doubles progress at 2× rate", () => {
    const tl = buildTimeline();
    const max = maxMatchMinute(tl);
    const clock = new MatchClock(tl, { rate: RATE_FAST });
    clock.play();

    vi.mocked(performance.now).mockReturnValue(tl.durationMs / 4);
    const t = clock.tick(performance.now());
    expect(t).toBeCloseTo(max / 2, 1);
  });

  it("seek clamps to [0, maxMinute]", () => {
    const tl = buildTimeline();
    const max = maxMatchMinute(tl);
    const clock = new MatchClock(tl);

    expect(clock.seek(-5)).toBe(0);
    expect(clock.seek(999)).toBe(max);
    expect(clock.seek(30)).toBe(30);
  });
});

describe("maxMatchMinute", () => {
  it("returns the highest event minute", () => {
    const tl = buildTimeline();
    const max = Math.max(...tl.events.map((e) => e.t));
    expect(maxMatchMinute(tl)).toBe(max);
  });
});
