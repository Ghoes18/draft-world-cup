/**
 * Shared types for the engine → timeline → presentation pipeline.
 *
 * The MatchTimeline / MatchEvent schema follows PRD §7.3 verbatim. Coordinates
 * are normalized pitch space (x = goal-to-goal length, y = touchline width,
 * each 0..1) for event placement and future consumers of the same timeline.
 */

/** Normalized pitch coordinate, 0..1 on each axis. */
export interface Vec2 {
  x: number;
  y: number;
}

export type Side = "home" | "away";

/** A single slot in a starting XI. */
export interface LineupSlot {
  /** Stable player id (eligibility validated server-side; not checked in M1). */
  playerId: string;
  /** Shirt number shown on the token. */
  number: number;
  /** Position code (e.g. "GK", "CB", "CM", "ST"). */
  position: string;
  /** Formation anchor in normalized pitch space (home-attacking-right frame). */
  anchor: Vec2;
}

/** A pass within a possession chain; `ball` is the receiver's location. */
export interface PassHop {
  fromId: string;
  toId: string;
  ball: Vec2;
}

export type ShotOutcome = "goal" | "saved" | "off" | "post";
export type PenaltyOutcome = "goal" | "miss" | "saved";

/** One kick in a penalty shootout. */
export interface ShootoutKick {
  team: Side;
  scored: boolean;
}

export type MatchEvent =
  | { t: number; type: "kickoff"; team: Side }
  | { t: number; type: "possession"; team: Side; passes: PassHop[] }
  | { t: number; type: "shot"; team: Side; from: Vec2; outcome: ShotOutcome }
  | {
      t: number;
      type: "goal";
      team: Side;
      scorerId: string;
      assistId?: string;
      from: Vec2;
    }
  | { t: number; type: "corner"; team: Side; side: "L" | "R" }
  | { t: number; type: "freekick"; team: Side; from: Vec2 }
  | { t: number; type: "penalty"; team: Side; outcome: PenaltyOutcome }
  | { t: number; type: "fulltime"; score: [number, number] }
  | { t: number; type: "shootout"; kicks: ShootoutKick[]; winner: Side };

export interface MatchScenario {
  team: string;
  cup: number;
}

export interface MatchTimeline {
  /** Server-owned seed string; the whole timeline derives from it. */
  seed: string;
  scenario: MatchScenario;
  lineups: Record<Side, LineupSlot[]>;
  result: { score: [number, number]; penalties?: [number, number] };
  /** Ordered by `t` (match minute). */
  events: MatchEvent[];
  /** Playback length at Fast ticker speed, in ms. */
  durationMs: number;
}
