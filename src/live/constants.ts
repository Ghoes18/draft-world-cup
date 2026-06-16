/** Simulated match length in minutes. */
export const LIVE_MATCH_MINUTES = 90;

/** Simulation ticks per match minute (10 ticks ≈ 6 s of match time each). */
export const TICKS_PER_MINUTE = 10;

export const LIVE_TOTAL_TICKS = LIVE_MATCH_MINUTES * TICKS_PER_MINUTE;

/** Max normalized-pitch movement per tick for outfield players. */
export const MAX_PLAYER_STEP = 0.0085;

/** Max normalized-pitch movement per tick for the goalkeeper. */
export const MAX_GK_STEP = 0.0055;

/** Max ball travel per tick during a pass (prevents missile passes). */
export const MAX_BALL_PASS_STEP = 0.024;

/** Slower cross flight speed. */
export const MAX_BALL_CROSS_STEP = 0.017;

/** Ball glued to carrier — slight offset toward facing direction. */
export const BALL_CARRY_OFFSET = 0.012;

/** Distance within which a defender can attempt a tackle. */
export const TACKLE_RANGE = 0.04;

/** Distance within which a player is considered open for a pass. */
export const PASS_MAX_RANGE = 0.45;

/** Shooting range from opponent goal line (x for home attack = 1). */
export const SHOOT_RANGE = 0.32;

/** Goal mouth y-range (normalized). */
export const GOAL_Y_MIN = 0.42;
export const GOAL_Y_MAX = 0.58;

/** Stamina drain per tick while sprinting / pressing. */
export const STAMINA_DRAIN = 0.00015;

/** Stamina recovery per tick at low intensity. */
export const STAMINA_RECOVERY = 0.00008;

/** Ticks to wait before restarting play from a dead ball. */
export const RESTART_DELAY_TICKS = 4;

/** Ticks before a set piece is taken. */
export const SET_PIECE_DELAY_TICKS = 6;

/** Loose ball velocity decay per tick. */
export const LOOSE_BALL_FRICTION = 0.88;

/** Distance to collect a loose ball. */
export const LOOSE_PICKUP_RADIUS = 0.034;

/** Radius for contested loose-ball pickup. */
export const LOOSE_CONTEST_RADIUS = 0.09;

/** Minimum forward progress (0..1) for crossing zones. */
export const CROSS_MIN_FORWARD = 0.52;

/** Touchline threshold — winger must be this wide. */
export const CROSS_TOUCHLINE_Y = 0.22;

/** Penalty spot distance from goal line (normalized). */
export const PENALTY_SPOT_X = 0.11;

/** Attacking box depth from goal line. */
export const BOX_DEPTH = 0.18;

/** Attacking box half-width from center. */
export const BOX_HALF_WIDTH = 0.15;

/** Base foul probability on failed tackle. */
export const FOUL_ON_TACKLE_CHANCE = 0.14;

/** Stoppage ticks added per goal. */
export const STOPPAGE_TICKS_PER_GOAL = 12;

/** Stoppage ticks added per foul or penalty award. */
export const STOPPAGE_TICKS_PER_FOUL = 8;

/** Max extra stoppage ticks (mirrors ~4 min allowance). */
export const MAX_STOPPAGE_TICKS = STOPPAGE_TICKS_PER_GOAL * 4;
