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
  /**
   * Player display name. Carried on the timeline so presentation is fully
   * self-describing (the ticker names everyone without the catalog). Omitted
   * for the neutral M1/CLI fallback XI, where consumers fall back to `#number`.
   */
  name?: string;
  /** Shirt number shown on the token. */
  number: number;
  /** Position code where the player is fielded (e.g. "GK", "CB", "CM", "ST"). */
  position: string;
  /**
   * Player's natural position, used for slot eligibility (`src/chemistry.ts`).
   * Omitted means "fielded in position" — treated as a perfect fit.
   */
  naturalPosition?: string;
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

/** Disciplinary card colour. */
export type CardColour = "yellow" | "red";

/** Period markers the live clock uses to label half-time and extra time. */
export type ExtraTimeMark = "start" | "ht" | "end";

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
  | { t: number; type: "foul"; team: Side; byId: string }
  | {
      t: number;
      type: "card";
      team: Side;
      playerId: string;
      card: CardColour;
      /** A red that came from a second bookable (yellow→yellow), not a straight red. */
      secondYellow?: boolean;
    }
  | {
      t: number;
      type: "substitution";
      team: Side;
      /** Player coming off (a real on-pitch lineup id). */
      outId: string;
      /**
       * Shirt number of the player coming on. Squads are 11-strong with no
       * bench in the data model, so this is a synthetic bench number (12–23)
       * for cosmetic ticker context only.
       */
      inNumber: number;
    }
  | { t: number; type: "offside"; team: Side }
  | { t: number; type: "throwin"; team: Side; side: "L" | "R" }
  | { t: number; type: "halftime" }
  | { t: number; type: "extratime"; mark: ExtraTimeMark }
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
