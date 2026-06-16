import type { FrameState } from "../render/types.js";
import type { LiveMatchState, LiveSnapshot } from "./types.js";

const EVENT_BANNERS: Partial<Record<string, string>> = {
  foul: "FOUL",
  freekick: "FREE KICK",
  penalty: "PENALTY",
  shootout: "SHOOTOUT",
  stoppage: "STOPPAGE TIME",
  goal: "GOAL!",
  cross: "CROSS",
};

/** Convert live snapshot to render FrameState. */
export function snapshotToFrame(snapshot: LiveSnapshot): FrameState {
  const carrier = snapshot.players.find((p) => p.hasBall);
  const lastType = snapshot.lastEvent?.type;
  const frame: FrameState = {
    matchTimeMin: snapshot.minute,
    score: snapshot.score,
    ball: { ...snapshot.ball },
    tokens: snapshot.players.map((p) => ({
      id: p.id,
      side: p.side,
      number: p.number,
      position: { ...p.pos },
      ...(p.hasBall ? { hasBall: true } : {}),
    })),
    phase:
      lastType === "goal"
        ? "goal"
        : lastType === "penalty"
          ? "penalty"
          : lastType === "freekick"
            ? "freekick"
            : lastType === "shootout"
              ? "shootout"
              : "possession",
    ...(carrier ? { carrierId: carrier.id } : {}),
  };
  if (snapshot.lastEvent?.type === "fulltime") {
    frame.phase = "fulltime";
    frame.banner = "FT";
  } else if (lastType && EVENT_BANNERS[lastType]) {
    frame.banner = EVENT_BANNERS[lastType];
  }
  return frame;
}

/** Build a snapshot from raw simulation state. */
export function stateToSnapshot(state: LiveMatchState): LiveSnapshot {
  const ownerId = state.ball.ownerId;
  const lastEvent = state.events.length > 0
    ? state.events[state.events.length - 1]
    : undefined;

  return {
    tick: state.tick,
    minute: state.minute,
    score: [state.homeScore, state.awayScore],
    ball: { ...state.ball.pos },
    ballMode: state.ball.mode,
    possession: state.possession,
    players: state.players.map((p) => ({
      id: p.id,
      side: p.side,
      number: p.number,
      pos: { ...p.pos },
      hasBall: ownerId === p.id && state.ball.mode === "carried",
    })),
    ...(lastEvent ? { lastEvent } : {}),
  };
}

/** Compress snapshots for network/replay (strip redundant fields). */
export function compressSnapshots(
  snapshots: LiveSnapshot[],
): Array<{
  t: number;
  s: [number, number];
  b: [number, number];
  p: Array<[string, number, number]>;
}> {
  return snapshots.map((snap) => ({
    t: snap.tick,
    s: snap.score,
    b: [snap.ball.x, snap.ball.y],
    p: snap.players.map((pl) => [pl.id, pl.pos.x, pl.pos.y]),
  }));
}
