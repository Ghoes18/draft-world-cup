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
/**
 * Expected-goals added per point of (midfield − opponentMidfield). A midfield
 * edge wins the ball and creates chances, nudging λ. This is a deliberate
 * extension beyond the live game's attack-vs-defense λ (CLAUDE.md parity note);
 * kept smaller than `LAMBDA_SLOPE` and TUNABLE (MVP §9). Set to 0 to restore
 * exact live-game parity.
 */
export const MIDFIELD_SLOPE = 0.04;

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
// Tactics — effective-rating modifiers (TUNABLE — MVP §9.4)
// ---------------------------------------------------------------------------

/** A single pre-match tactical choice (MVP §4.6). */
export type Tactic = "offensive" | "balanced" | "defensive";

/** Tactic δ: rating points traded between attack and your defense. */
export const TACTIC_DELTA = 4;

/**
 * Position-fit tiers for slot eligibility (`src/chemistry.ts`): full credit for
 * the exact role, partial for an adjacent role, little for an unrelated one.
 */
export const FIT_EXACT = 1.0;
export const FIT_ADJACENT = 0.5;
export const FIT_UNRELATED = 0.15;

// ---------------------------------------------------------------------------
// Chemistry / synergy — squad cohesion + legend bonus (TUNABLE — MVP §9)
// ---------------------------------------------------------------------------

/**
 * Synergy "links" between two fielded players, summed pairwise across the XI.
 * Two tiers: real teammates (same national team AND same World Cup edition)
 * count fully; countrymen (same team, different edition) count partially.
 */
export const LINK_TEAMMATE = 1.0; // same team + same cup
export const LINK_COUNTRYMAN = 0.4; // same team, different cup

/**
 * Pair-points at which chemistry saturates to 100%. Total link score is mapped
 * to chemistry% via `50 + clamp(linkScore / CHEM_SATURATION, 0, 1) * 50`, so a
 * lineup with no links sits at a neutral 50% (no penalty) and a tightly-knit
 * squad reaches 100% → +3 (CLAUDE.md chemistryBonus model).
 */
export const CHEM_SATURATION = 12;
/** Engine swing per side of the chemistry% range (CLAUDE.md: ≈ −3…+3). */
export const CHEM_BONUS_RANGE = 6;

/** Overall rating added per legend fielded, capped so a full legend XI stays sane. */
export const LEGEND_OVERALL_PER = 1;
export const LEGEND_OVERALL_CAP = 4;

// ---------------------------------------------------------------------------
// Match shape
// ---------------------------------------------------------------------------

/** Regulation length in minutes; goals are placed within this window. */
export const REGULATION_MINUTES = 90;
/** Light stoppage-time allowance so a late goal can land at e.g. 90+2. */
export const STOPPAGE_ALLOWANCE = 4;

/**
 * Knockout extra time (two 15-min halves) played when a knockout tie is level
 * after 90'. ET can produce goals; only a still-level tie goes to penalties.
 * TUNABLE — there is no source for these in the live game (it goes straight to
 * penalties); see CLAUDE.md note in `simulateMatch`.
 */
export const EXTRA_TIME_MINUTES = 30;
/** Half-way point of extra time (first ET half ends here). */
export const EXTRA_TIME_HALF = REGULATION_MINUTES + EXTRA_TIME_MINUTES / 2; // 105
/** Last minute extra-time goals can land on (before the +stoppage allowance). */
export const EXTRA_TIME_END = REGULATION_MINUTES + EXTRA_TIME_MINUTES; // 120
/** ET expected goals ≈ 30/90 of the regulation rate (shorter, cagier period). */
export const EXTRA_TIME_LAMBDA_SCALE = 0.33;

// ---------------------------------------------------------------------------
// Calibration — timeline generation (TUNABLE — MVP §9 / PRD §15)
// ---------------------------------------------------------------------------

/**
 * No goal-minute distribution exists in this repo, so M1 defines one: goals are
 * drawn uniformly across the playable window with a minimum spacing so they do
 * not cluster. Tune freely; presentation consumers never depend on these values.
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

/**
 * Match "incidents" — cosmetic non-goal chronology (fouls, cards, subs,
 * offsides, throw-ins). Like all filler these can never change the score; the
 * counts are deliberately modest so the live ticker stays readable. TUNABLE.
 */
export const FOULS_PER_MATCH = 20; // total fouls across both sides
export const FOUL_TO_FREEKICK = 0.4; // a foul that yields a quick free kick
export const CARD_PER_FOUL = 0.12; // a foul that earns a card
export const RED_CARD_CHANCE = 0.06; // a card that is red rather than yellow
export const SUBS_PER_SIDE = 3; // substitutions each side makes (60'–85')
export const OFFSIDES_PER_MATCH = 4; // total offside calls across both sides
export const THROWINS_PER_MATCH = 8; // total throw-ins surfaced (sampled, not every one)

// ---------------------------------------------------------------------------
// Roll / Build — live 7a0 draft flow (MVP §4.5.1)
// ---------------------------------------------------------------------------

/**
 * Global rerolls for the whole draft (team+year or year-only).
 *
 * 7a0 uses 3 rerolls for 1950–2026 (20 men's WC editions). This catalog spans
 * 1930–2026 (23 editions: +1930, 1934, 1938). Five rerolls — one extra
 * per pre-1950 decade of history on top of 7a0's three.
 */
export const GLOBAL_REROLLS_PER_BUILD = 5;

/** @deprecated Per-slot candidate batches — superseded by turn-based draft. */
export const CANDIDATES_PER_SLOT = 3;
/** @deprecated Per-slot rerolls — superseded by GLOBAL_REROLLS_PER_BUILD. */
export const REROLLS_PER_SLOT = 3;
/** @deprecated Emergency rerolls — superseded by GLOBAL_REROLLS_PER_BUILD. */
export const EMERGENCY_REROLLS_TOTAL = 1;

// ---------------------------------------------------------------------------
// Player force → engine rating scale (TUNABLE — MVP §9)
// ---------------------------------------------------------------------------

/** Multiply raw force (0–255) to engine rating scale (~0–100). */
export const FORCE_TO_RATING = 100 / 255;

/** Salt used by live 7a0 to obfuscate squad JSON `f` fields. */
export const FORCE_OBFUSCATION_SALT = "7a0::alm::v1";
/**
 * Match-minutes before a terminal event (shot, goal, corner) that the linked
 * possession buildup starts. Keeps attacks narratively continuous in text replay.
 */
export const BUILDUP_LEAD_MIN = 1.0;

// ---------------------------------------------------------------------------
// Stats — per-shot xG weights (TUNABLE — MVP §4.4 / §9)
// ---------------------------------------------------------------------------

/**
 * Approximate xG is derived purely from the timeline's shot events: each shot
 * contributes a weight by outcome and they sum to a side's expected goals (an
 * estimate of the engine λ that produced the shots). Tunable; presentation is
 * unaffected. A penalty that scored is represented by its `goal` event, so only
 * non-goal penalty attempts use XG_PENALTY (no double count — see stats.ts).
 */
export const XG_GOAL = 0.45;
export const XG_ON_TARGET = 0.25; // saved
export const XG_POST = 0.12;
export const XG_OFF = 0.05;
export const XG_PENALTY = 0.79;
