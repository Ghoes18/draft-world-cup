import type { LineupSlot, Side, Vec2 } from "../types.js";

/** Per-match tactical posture — biases AI risk appetite. */
export type LiveTactic = "offensive" | "balanced" | "defensive";

/** Derived skill ratings (0..100 scale). */
export interface PlayerAttributes {
  passing: number;
  dribbling: number;
  shooting: number;
  defending: number;
  goalkeeping: number;
  intelligence: number;
  pace: number;
  stamina: number;
}

/** One outfield or GK token in the live simulation. */
export interface LivePlayer {
  id: string;
  side: Side;
  number: number;
  position: string;
  anchor: Vec2;
  pos: Vec2;
  vel: Vec2;
  attrs: PlayerAttributes;
  /** Remaining stamina 0..1. */
  stamina: number;
  /** True for the side's goalkeeper. */
  isGoalkeeper: boolean;
}

/** Ball flight / possession mode. */
export type BallMode = "dead" | "carried" | "pass" | "shot" | "loose" | "cross";

export interface LiveBall {
  pos: Vec2;
  vel: Vec2;
  mode: BallMode;
  /** Player carrying or last touched. */
  ownerId: string | null;
  /** Intended receiver during a pass. */
  targetId: string | null;
  /** Whether the in-flight pass is a through ball. */
  throughBall: boolean;
  /** Target zone for crosses (box area). */
  targetZone: Vec2 | null;
  /** Ticks remaining before a dead ball is restarted. */
  restartDelay: number;
}

/** Active set piece waiting to be taken. */
export type SetPieceKind = "freekick" | "penalty";

export interface SetPieceState {
  kind: SetPieceKind;
  side: Side;
  spot: Vec2;
  takerId: string;
  delayTicks: number;
}

/** Match segment after regulation. */
export type MatchSegment = "open_play" | "shootout";

/** Discrete action chosen by AI for one tick window. */
export type LiveAction =
  | { kind: "hold" }
  | { kind: "carry"; direction: Vec2 }
  | { kind: "pass"; targetId: string }
  | { kind: "through"; targetId: string }
  | { kind: "cross"; targetZone: Vec2 }
  | { kind: "dribble"; direction: Vec2 }
  | { kind: "shoot" }
  | { kind: "press"; targetId: string }
  | { kind: "tackle"; targetId: string }
  | { kind: "intercept" }
  | { kind: "recover" };

/** Outcome of a contested or skill check. */
export type ActionOutcome =
  | { result: "success" }
  | { result: "fail"; reason: string }
  | { result: "goal" }
  | { result: "saved"; keeperId: string }
  | { result: "off_target" };

/** Logged match event from the live sim (subset for replay/debug). */
export interface LiveMatchEvent {
  tick: number;
  minute: number;
  type:
    | "kickoff"
    | "pass"
    | "cross"
    | "dribble"
    | "tackle"
    | "foul"
    | "freekick"
    | "penalty"
    | "shot"
    | "goal"
    | "save"
    | "turnover"
    | "stoppage"
    | "shootout"
    | "fulltime";
  side: Side;
  playerId?: string;
  targetId?: string;
  detail?: string;
}

/** Shootout summary attached to live result. */
export interface LiveShootoutResult {
  tally: [number, number];
  winner: Side;
}

/** Full mutable simulation state. */
export interface LiveMatchState {
  seed: string;
  tick: number;
  minute: number;
  homeScore: number;
  awayScore: number;
  possession: Side;
  teamOveralls: Record<Side, number>;
  players: LivePlayer[];
  ball: LiveBall;
  events: LiveMatchEvent[];
  finished: boolean;
  /** Regulation end tick; stoppage extends beyond this. */
  regulationEndTick: number;
  /** Extra ticks added from goals, fouls, etc. */
  stoppageTicks: number;
  segment: MatchSegment;
  setPiece: SetPieceState | null;
  knockout: boolean;
  shootout?: LiveShootoutResult;
}

/** Input to start a live match. */
export interface LiveMatchConfig {
  seed: string;
  lineups: Record<Side, LineupSlot[]>;
  tactics: Record<Side, LiveTactic>;
  /** Team overall used when per-player ratings are absent. */
  teamOveralls: Record<Side, number>;
  /** Optional per-player overall overrides keyed by playerId. */
  playerOveralls?: Record<string, number>;
  /** If true, tied matches go to a penalty shootout. */
  knockout?: boolean;
}

/** One renderable frame derived from live state. */
export interface LiveSnapshot {
  tick: number;
  minute: number;
  score: [number, number];
  ball: Vec2;
  ballMode: BallMode;
  players: Array<{
    id: string;
    side: Side;
    number: number;
    pos: Vec2;
    hasBall: boolean;
  }>;
  possession: Side;
  lastEvent?: LiveMatchEvent;
}

/** Output of a full live simulation run. */
export interface LiveMatchResult {
  seed: string;
  score: [number, number];
  events: LiveMatchEvent[];
  snapshots: LiveSnapshot[];
  finalState: LiveMatchState;
  shootout?: LiveShootoutResult;
  winner: Side | "draw";
}
