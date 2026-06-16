import { describe, expect, it } from "vitest";
import { simulateMatch, type TeamStrength } from "../src/engine.js";
import { defaultLineup } from "../src/lineup.js";
import { generateTimeline } from "../src/timeline/generate.js";
import { toFastText } from "../src/consumers/fastText.js";
import type { MatchEvent, MatchTimeline, Side } from "../src/types.js";

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

function countGoals(events: MatchEvent[], side: Side): number {
  return events.filter((e) => e.type === "goal" && e.team === side).length;
}

describe("generateTimeline", () => {
  it("is deterministic for a given seed", () => {
    expect(build("dup-seed")).toEqual(build("dup-seed"));
  });

  it("reconciles goal events to the engine score", () => {
    for (let i = 0; i < 100; i++) {
      const tl = build(`rec${i}`);
      expect(countGoals(tl.events, "home")).toBe(tl.result.score[0]);
      expect(countGoals(tl.events, "away")).toBe(tl.result.score[1]);
    }
  });

  it("ends with a fulltime event carrying the exact score", () => {
    const tl = build("ft");
    const ft = tl.events.find((e) => e.type === "fulltime");
    expect(ft).toBeDefined();
    if (ft?.type === "fulltime") {
      expect(ft.score).toEqual(tl.result.score);
    }
  });

  it("orders events by ascending minute, kickoff first", () => {
    const tl = build("order");
    expect(tl.events[0]?.type).toBe("kickoff");
    for (let i = 1; i < tl.events.length; i++) {
      expect(tl.events[i]!.t).toBeGreaterThanOrEqual(tl.events[i - 1]!.t);
    }
  });

  it("emits a shootout for knockout draws, consistent with the result", () => {
    let sawShootout = false;
    for (let i = 0; i < 200; i++) {
      const result = simulateMatch({
        home: WEAK,
        away: WEAK,
        seed: `kt${i}`,
        knockout: true,
      });
      if (!result.shootout) continue;
      sawShootout = true;
      const tl = generateTimeline({
        result,
        seed: `kt${i}`,
        scenario: { team: "Test", cup: 1970 },
        lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
      });
      const so = tl.events.find((e) => e.type === "shootout");
      expect(so).toBeDefined();
      if (so?.type === "shootout") {
        expect(so.winner).toBe(result.shootout.winner);
      }
    }
    expect(sawShootout).toBe(true);
  });

  it("has a positive playback duration", () => {
    expect(build("dur").durationMs).toBeGreaterThan(0);
  });
});

describe("toFastText", () => {
  it("produces a GOAL line per goal and a final FT line matching the score", () => {
    const tl = build("text-seed");
    const lines = toFastText(tl, { labels: { home: "HOME", away: "AWAY" } });
    const goalLines = lines.filter((l) => l.includes("GOAL!"));
    expect(goalLines.length).toBe(tl.result.score[0] + tl.result.score[1]);

    const ft = lines.find((l) => l.startsWith("FT"));
    expect(ft).toContain(`${tl.result.score[0]}–${tl.result.score[1]}`);
  });

  it("is fully usable as text (no empty lines, every line is a string)", () => {
    const lines = toFastText(build("a11y"));
    expect(lines.length).toBeGreaterThan(0);
    for (const l of lines) expect(l.trim().length).toBeGreaterThan(0);
  });
});
