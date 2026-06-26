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

  it("surfaces incident events (fouls, subs, offsides, throw-ins) and a half-time marker", () => {
    const tl = build("incidents");
    const types = new Set(tl.events.map((e) => e.type));
    for (const t of ["foul", "substitution", "offside", "throwin", "halftime"] as const) {
      expect(types.has(t)).toBe(true);
    }
  });

  it("produces cards across matches", () => {
    let sawCard = false;
    for (let i = 0; i < 30 && !sawCard; i++) {
      sawCard = build(`cards${i}`).events.some((e) => e.type === "card");
    }
    expect(sawCard).toBe(true);
  });
});

describe("generateTimeline — extra time", () => {
  const EVEN: TeamStrength = { attack: 80, defense: 80, overall: 80 };

  function buildET(seed: string) {
    const result = simulateMatch({ home: EVEN, away: EVEN, seed, knockout: true });
    const tl = generateTimeline({
      result,
      seed,
      scenario: { team: "Test", cup: 1970 },
      lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
    });
    return { result, tl };
  }

  it("keeps regulation goals by 90' and places extra-time goals after it", () => {
    let sawET = false;
    for (let i = 0; i < 300 && !sawET; i++) {
      const { result, tl } = buildET(`tlet${i}`);
      if (!result.extraTime) continue;
      sawET = true;

      const goals = tl.events.filter((e) => e.type === "goal");
      const regCount = result.regulation[0] + result.regulation[1];
      expect(goals.filter((g) => g.t <= 90).length).toBe(regCount);
      expect(goals.filter((g) => g.t > 90).length).toBe(
        result.score[0] + result.score[1] - regCount,
      );
      expect(
        tl.events.some((e) => e.type === "extratime" && e.mark === "start"),
      ).toBe(true);
      const ft = tl.events.find((e) => e.type === "fulltime");
      expect(ft && ft.type === "fulltime" && ft.t).toBeGreaterThanOrEqual(120);
    }
    expect(sawET).toBe(true);
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

  it("renders penalties kick-by-kick with a final winning line", () => {
    let checked = false;
    for (let i = 0; i < 400 && !checked; i++) {
      const result = simulateMatch({
        home: WEAK,
        away: WEAK,
        seed: `pk${i}`,
        knockout: true,
      });
      if (!result.shootout) continue;
      checked = true;
      const tl = generateTimeline({
        result,
        seed: `pk${i}`,
        scenario: { team: "Test", cup: 1970 },
        lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
      });
      const lines = toFastText(tl, { labels: { home: "HOME", away: "AWAY" } });
      expect(lines.some((l) => l.includes("Penalty shootout"))).toBe(true);
      const kicks = lines.filter((l) => l.includes("scored") || l.includes("missed"));
      expect(kicks.length).toBe(result.shootout.kicks.length);
      expect(lines.some((l) => l.startsWith("Penalties:") && l.includes("win"))).toBe(true);
    }
    expect(checked).toBe(true);
  });
});
