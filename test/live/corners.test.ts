import { describe, expect, it } from "vitest";
import { defaultLineup } from "../../src/lineup.js";
import {
  createLiveMatchState,
  simulateLiveMatch,
  tickLiveMatch,
} from "../../src/live/simulator.js";
import { rngFromSeed } from "../../src/rng.js";
import type { Side } from "../../src/types.js";
import type { LiveMatchConfig, LiveMatchState } from "../../src/live/types.js";

const TACTICS = { home: "balanced", away: "balanced" } as const;

function baseConfig(seed: string): LiveMatchConfig {
  return {
    seed,
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
    tactics: { home: "balanced", away: "balanced" },
    teamOveralls: { home: 80, away: 80 },
  };
}

/** Put the ball in flight toward the away byline (x > 1), far from any receiver. */
function sendBallOverAwayByline(state: LiveMatchState, lastTouchSide: Side): void {
  const toucher = state.players.find((p) => p.side === lastTouchSide && !p.isGoalkeeper)!;
  state.ball.mode = "pass";
  state.ball.ownerId = null;
  state.ball.targetId = state.players.find((p) => p.side === "home" && p.isGoalkeeper)!.id;
  state.ball.pos = { x: 0.99, y: 0.25 };
  state.ball.vel = { x: 0.06, y: 0 };
  state.ball.lastTouchId = toucher.id;
  state.ball.lastTouchSide = lastTouchSide;
  state.setPiece = null;
}

describe("live corners and last-touch", () => {
  it("initializes and maintains a last touch", () => {
    const state = createLiveMatchState(baseConfig("touch-init"));
    expect(state.ball.lastTouchSide).toBe("home");
    expect(state.ball.lastTouchId).not.toBeNull();

    const rng = rngFromSeed("touch-run");
    for (let i = 0; i < 40; i++) tickLiveMatch(state, TACTICS, rng);
    expect(state.ball.lastTouchSide === "home" || state.ball.lastTouchSide === "away").toBe(true);
    const toucher = state.players.find((p) => p.id === state.ball.lastTouchId);
    expect(toucher).toBeDefined();
  });

  it("awards a corner when a defender puts the ball behind", () => {
    const state = createLiveMatchState(baseConfig("corner-case"));
    // Away defends the x>1 goal line; an away touch out over it is a corner for home.
    sendBallOverAwayByline(state, "away");
    const rng = rngFromSeed("corner-case");
    tickLiveMatch(state, TACTICS, rng);

    expect(state.setPiece?.kind).toBe("corner");
    expect(state.setPiece?.side).toBe("home");
    expect(state.events.some((e) => e.type === "corner" && e.side === "home")).toBe(true);
    // The ball sits at the away corner flag (deep, against the touchline).
    expect(state.ball.pos.x).toBeGreaterThan(0.9);
    expect(state.ball.pos.y < 0.1 || state.ball.pos.y > 0.9).toBe(true);
  });

  it("awards a goal kick (not a corner) when an attacker puts it behind", () => {
    const state = createLiveMatchState(baseConfig("gk-case"));
    // Home attacks the x>1 line; a home touch out over it is a goal kick for away.
    sendBallOverAwayByline(state, "home");
    const rng = rngFromSeed("gk-case");
    tickLiveMatch(state, TACTICS, rng);

    expect(state.setPiece).toBeNull();
    expect(state.events.some((e) => e.type === "corner")).toBe(false);
    expect(state.possession).toBe("away");
  });

  it("produces corners and goal kicks across full matches", () => {
    const seeds = ["c1", "c2", "c3", "c4", "c5", "c6"];
    let corners = 0;
    let goalkicks = 0;
    for (const seed of seeds) {
      const r = simulateLiveMatch(baseConfig(seed), { snapshotStride: 30 });
      corners += r.events.filter((e) => e.type === "corner").length;
      goalkicks += r.events.filter((e) => e.type === "goalkick").length;
      for (const e of r.events.filter((ev) => ev.type === "corner")) {
        expect(e.side === "home" || e.side === "away").toBe(true);
        expect(e.playerId).toBeDefined();
      }
    }
    expect(corners).toBeGreaterThan(0);
    expect(goalkicks).toBeGreaterThan(0);
  });
});
