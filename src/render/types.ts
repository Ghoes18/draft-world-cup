import type { Side, Vec2 } from "../types.js";

/** Visual phase for choreographed beats. */
export type ChoreoPhase =
  | "open"
  | "possession"
  | "shot"
  | "corner"
  | "freekick"
  | "penalty"
  | "goal"
  | "celebration"
  | "fulltime"
  | "shootout";

/** One player token on the pitch. */
export interface TokenState {
  id: string;
  side: Side;
  number: number;
  position: Vec2;
  /** True when this player is carrying the ball. */
  hasBall?: boolean;
}

/** Pure snapshot for one animation frame — no canvas references. */
export interface FrameState {
  matchTimeMin: number;
  score: [number, number];
  ball: Vec2;
  tokens: TokenState[];
  phase: ChoreoPhase;
  /** Optional banner (e.g. "GOAL!", "FT"). */
  banner?: string;
  /** Ball carrier player id when known. */
  carrierId?: string;
}

/** Canvas colour palette. */
export interface RenderTheme {
  pitch: string;
  pitchLine: string;
  homeToken: string;
  awayToken: string;
  homeText: string;
  awayText: string;
  ball: string;
  bannerBg: string;
  bannerText: string;
  scoreBg: string;
  scoreText: string;
}

export const DEFAULT_THEME: RenderTheme = {
  pitch: "#2d6a3e",
  pitchLine: "rgba(255,255,255,0.85)",
  homeToken: "#1e4d8c",
  awayToken: "#8c1e2a",
  homeText: "#ffffff",
  awayText: "#ffffff",
  ball: "#f5f5f0",
  bannerBg: "rgba(0,0,0,0.65)",
  bannerText: "#ffffff",
  scoreBg: "rgba(0,0,0,0.5)",
  scoreText: "#ffffff",
};
