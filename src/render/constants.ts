/**
 * Render-only tunables. The engine and timeline never read these.
 */

/** Match-minute window for a dramatic beat (goal, shot, corner, etc.). */
export const BEAT_DURATION_MIN = 1.4;

/** How far the team block shifts toward the ball (fraction of pitch). */
export const BLOCK_SHIFT_X = 0.12;
export const BLOCK_SHIFT_Y = 0.08;

/** Amplitude of seeded idle sway on player tokens (normalized pitch units). */
export const IDLE_NOISE_AMP = 0.012;

/** Bézier arc height for shots, corners, and free kicks (normalized). */
export const ARC_LIFT = 0.18;

/** Penalty spot distance from goal line (normalized x). */
export const PENALTY_SPOT_X = 0.11;

/** Corner flag inset from touchline (normalized). */
export const CORNER_INSET = 0.02;

/** Shootout: spot x for home (attacks right) and away. */
export const SHOOTOUT_SPOT_HOME = 0.88;
export const SHOOTOUT_SPOT_AWAY = 0.12;

/** Canvas padding around the pitch (CSS px, before DPR). */
export const PITCH_PADDING_PX = 24;

/** Token and ball radii as a fraction of pitch short side. */
export const TOKEN_RADIUS_FRAC = 0.028;
export const BALL_RADIUS_FRAC = 0.014;

/** Default playback rates. */
export const RATE_NORMAL = 1;
export const RATE_FAST = 2;
