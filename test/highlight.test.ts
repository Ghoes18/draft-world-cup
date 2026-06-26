import { describe, expect, it } from "vitest";
import {
  decodeHighlight,
  encodeHighlight,
  highlightBadges,
  highlightToTimeline,
  toHighlight,
  toHighlightText,
  type HighlightPayload,
} from "../src/highlight.js";
import type { LineupSlot, MatchEvent, MatchTimeline, Side } from "../src/types.js";

function slot(playerId: string, name: string, number: number): LineupSlot {
  return { playerId, name, number, position: "ST", anchor: { x: 0.5, y: 0.5 } };
}

/** A small, hand-built timeline with named players for deterministic assertions. */
function sampleTimeline(events: MatchEvent[], score: [number, number]): MatchTimeline {
  return {
    seed: "sample",
    scenario: { team: "England", cup: 2018 },
    lineups: {
      home: [slot("h1", "Harry Kane", 9), slot("h2", "Eric Dier", 4)],
      away: [slot("a1", "Luka Modric", 10)],
    },
    result: { score },
    events,
    durationMs: 0,
  };
}

const PAYLOAD: HighlightPayload = {
  v: 1,
  scn: ["England", 2018],
  sc: [3, 1],
  lb: ["Your XI", "Croatia"],
  tg: "'2018",
  g: [
    [12, 0, "Harry Kane", "Eric Dier"],
    [40, 1, "Luka Modric"],
    [55, 0, "Harry Kane"],
    [78, 0, "Harry Kane"],
  ],
};

describe("highlight codec", () => {
  it("round-trips through encode/decode", () => {
    expect(decodeHighlight(encodeHighlight(PAYLOAD))).toEqual(PAYLOAD);
  });

  it("produces a URL-safe code (no +, /, or =)", () => {
    const code = encodeHighlight(PAYLOAD);
    expect(code).toMatch(/^[A-Za-z0-9_-]+$/);
  });

  it("rejects an unknown version", () => {
    const bad = encodeHighlight({ ...PAYLOAD, v: 2 as unknown as 1 });
    expect(() => decodeHighlight(bad)).toThrow();
  });

  it("rejects malformed input", () => {
    expect(() => decodeHighlight("not-base64-$$$")).toThrow();
  });
});

describe("toHighlight", () => {
  it("keeps exactly the goals, with names resolved", () => {
    const tl = sampleTimeline(
      [
        { t: 0, type: "kickoff", team: "home" },
        { t: 12, type: "goal", team: "home", scorerId: "h1", assistId: "h2", from: { x: 0.5, y: 0.5 } },
        { t: 30, type: "corner", team: "home", side: "L" },
        { t: 40, type: "goal", team: "away", scorerId: "a1", from: { x: 0.5, y: 0.5 } },
        { t: 90, type: "fulltime", score: [1, 1] },
      ],
      [1, 1],
    );
    const h = toHighlight(tl, { labels: { home: "Your XI", away: "Croatia" } });
    expect(h.g).toEqual([
      [12, 0, "Harry Kane", "Eric Dier"],
      [40, 1, "Luka Modric"],
    ]);
    expect(h.sc).toEqual([1, 1]);
    expect(h.scn).toEqual(["England", 2018]);
  });

  it("captures penalties and the shootout for a knockout draw", () => {
    const tl: MatchTimeline = {
      ...sampleTimeline(
        [
          { t: 0, type: "kickoff", team: "home" },
          { t: 100, type: "extratime", mark: "start" },
          {
            t: 120,
            type: "shootout",
            kicks: [
              { team: "home", scored: true },
              { team: "away", scored: false },
            ],
            winner: "home",
          },
        ],
        [0, 0],
      ),
      result: { score: [0, 0], penalties: [4, 3] },
    };
    const h = toHighlight(tl, { labels: { home: "Your XI", away: "Croatia" } });
    expect(h.pe).toEqual([4, 3]);
    expect(h.et).toBe(1);
    expect(h.so).toEqual([
      [0, 1],
      [1, 0],
    ]);
  });
});

describe("highlightToTimeline", () => {
  it("reconciles goal events to the score", () => {
    const tl = highlightToTimeline(PAYLOAD);
    const count = (side: Side) => tl.events.filter((e) => e.type === "goal" && e.team === side).length;
    expect(count("home")).toBe(PAYLOAD.sc[0]);
    expect(count("away")).toBe(PAYLOAD.sc[1]);
    expect(tl.result.score).toEqual(PAYLOAD.sc);
  });

  it("resolves scorer names back through the lineup lookup", () => {
    const tl = highlightToTimeline(PAYLOAD);
    const goal = tl.events.find((e) => e.type === "goal");
    expect(goal && goal.type === "goal" && goal.scorerId).toBe("Harry Kane");
    const named = [...tl.lineups.home, ...tl.lineups.away].map((s) => s.name);
    expect(named).toContain("Harry Kane");
    expect(named).toContain("Luka Modric");
  });

  it("keeps events ordered by minute", () => {
    const tl = highlightToTimeline(PAYLOAD);
    const ts = tl.events.map((e) => e.t);
    expect([...ts].sort((a, b) => a - b)).toEqual(ts);
  });
});

describe("highlightBadges", () => {
  const base: Omit<HighlightPayload, "sc" | "g"> = {
    v: 1,
    scn: ["England", 2018],
    lb: ["Your XI", "Opp"],
  };

  it("awards 7–0 and esmagador for the dream scoreline", () => {
    const ids = highlightBadges({
      ...base,
      sc: [7, 0],
      g: Array.from({ length: 7 }, (_, i): HighlightPayload["g"][number] => [10 + i, 0, `P${i % 4}`]),
    }).map((b) => b.id);
    expect(ids).toContain("seven-nil");
    expect(ids).toContain("esmagador");
    expect(ids).not.toContain("clean-sheet"); // folded into 7–0
  });

  it("detects a hat-trick", () => {
    const ids = highlightBadges({
      ...base,
      sc: [3, 1],
      g: [
        [10, 0, "Kane"],
        [20, 0, "Kane"],
        [30, 1, "Modric"],
        [40, 0, "Kane"],
      ],
    }).map((b) => b.id);
    expect(ids).toContain("hat-trick");
  });

  it("awards a clean sheet for a modest shutout win", () => {
    const ids = highlightBadges({
      ...base,
      sc: [2, 0],
      g: [
        [10, 0, "Kane"],
        [20, 0, "Sterling"],
      ],
    }).map((b) => b.id);
    expect(ids).toContain("clean-sheet");
    expect(ids).not.toContain("esmagador");
  });
});

describe("toHighlightText", () => {
  it("emits one line per goal plus full time", () => {
    const lines = toHighlightText(PAYLOAD);
    expect(lines.filter((l) => l.includes("GOAL!"))).toHaveLength(4);
    expect(lines.at(-1)).toContain("FT");
  });
});
