/**
 * Engine + timeline constants for 7a0 (Sete a Zero).
 *
 * The ENGINE block must match the live game exactly — this is what makes the
 * new modes "feel" like the original (see CLAUDE.md / PRD §16.1). The TIMELINE
 * and CALIBRATION blocks below have no source in this repo, so M1 defines
 * sensible defaults here; they are tunable and flagged as open decisions
 * (MVP §9 / PRD §15). Keep all tunables centralized in this file.
 */

// ---------------------------------------------------------------------------
// Engine — goal model (must match exactly)
// ---------------------------------------------------------------------------

/** Base expected goals when two teams are evenly matched. */
export const BASE_LAMBDA = 1.4;
/** Expected-goals added per point of (attack − opponentDefense). */
export const LAMBDA_SLOPE = 0.08;
/** Lower clamp on λ. */
export const MIN_LAMBDA = 0.15;
/** Upper clamp on λ. */
export const MAX_LAMBDA = 5;

// ---------------------------------------------------------------------------
// Engine — knockout penalty model (must match exactly)
// ---------------------------------------------------------------------------

/** Base probability of winning a shootout (even teams = coin flip). */
export const PENALTY_BASE = 0.5;
/** Win-probability shift per point of strength difference. */
export const PENALTY_SLOPE = 0.012;
/** Clamp bounds on shootout win probability. */
export const PENALTY_MIN = 0.1;
export const PENALTY_MAX = 0.9;

// ---------------------------------------------------------------------------
// Campaign — solo opponent overalls by phase (PRD §2.3 / §16.1)
// ---------------------------------------------------------------------------

export type CampaignPhase =
  | "group1"
  | "group2"
  | "group3"
  | "r16"
  | "qf"
  | "sf"
  | "final";

/** Opponent overall rating for each solo-campaign phase. */
export const CAMPAIGN_OPPONENT_OVERALL: Record<CampaignPhase, number> = {
  group1: 68,
  group2: 72,
  group3: 76,
  r16: 79,
  qf: 83,
  sf: 87,
  final: 91,
};

/** Which phases are knockout (draws go to penalties). */
export const KNOCKOUT_PHASES: ReadonlySet<CampaignPhase> = new Set([
  "r16",
  "qf",
  "sf",
  "final",
]);

// ---------------------------------------------------------------------------
// Match shape
// ---------------------------------------------------------------------------

/** Regulation length in minutes; goals are placed within this window. */
export const REGULATION_MINUTES = 90;
/** Light stoppage-time allowance so a late goal can land at e.g. 90+2. */
export const STOPPAGE_ALLOWANCE = 4;

// ---------------------------------------------------------------------------
// Calibration — timeline generation (TUNABLE — MVP §9 / PRD §15)
// ---------------------------------------------------------------------------

/**
 * No goal-minute distribution exists in this repo, so M1 defines one: goals are
 * drawn uniformly across the playable window with a minimum spacing so they do
 * not cluster. Tune freely; the renderers never depend on these values.
 */
export const GOAL_MIN_MINUTE = 1;
export const GOAL_MAX_MINUTE = REGULATION_MINUTES + STOPPAGE_ALLOWANCE;
/** Minimum gap (minutes) enforced between two goals when spacing them out. */
export const GOAL_MIN_SPACING = 4;

/**
 * Cosmetic filler frequency. Shots-per-side scale with that side's λ; corners
 * are a fraction of shots; possession chains fill the rest. None of this can
 * change the score (the final `fulltime` event reconciles to the engine).
 */
export const SHOTS_PER_LAMBDA = 4; // baseline non-goal shot attempts per expected goal
export const CORNERS_PER_SHOT = 0.35;
/** Probability that a given goal is dramatised as a penalty (rare). */
export const PENALTY_GOAL_CHANCE = 0.08;
/** Passes per possession chain (inclusive range). */
export const PASSES_MIN = 2;
export const PASSES_MAX = 6;
