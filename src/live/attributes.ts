import type { LineupSlot, Side } from "../types.js";
import type { LiveTactic, PlayerAttributes } from "./types.js";

/** Position-group modifiers applied on top of base overall. */
const POSITION_MODS: Record<string, Partial<PlayerAttributes>> = {
  GK: {
    goalkeeping: 18,
    defending: 4,
    passing: -8,
    dribbling: -12,
    shooting: -15,
    pace: -6,
  },
  RB: { defending: 6, passing: 2, pace: 4, dribbling: 0, shooting: -4 },
  LB: { defending: 6, passing: 2, pace: 4, dribbling: 0, shooting: -4 },
  RCB: { defending: 10, passing: -2, pace: -2, dribbling: -4, shooting: -6 },
  LCB: { defending: 10, passing: -2, pace: -2, dribbling: -4, shooting: -6 },
  CB: { defending: 10, passing: -2, pace: -2, dribbling: -4, shooting: -6 },
  RCM: { passing: 8, intelligence: 6, defending: 2, shooting: 0 },
  LCM: { passing: 8, intelligence: 6, defending: 2, shooting: 0 },
  CM: { passing: 10, intelligence: 8, defending: 0, shooting: 2 },
  CDM: { defending: 8, passing: 6, intelligence: 4, shooting: -4 },
  CAM: { passing: 6, dribbling: 6, shooting: 8, intelligence: 6 },
  RW: { pace: 10, dribbling: 8, passing: 2, shooting: 4 },
  LW: { pace: 10, dribbling: 8, passing: 2, shooting: 4 },
  ST: { shooting: 12, pace: 4, dribbling: 4, passing: -2, defending: -8 },
  CF: { shooting: 10, dribbling: 6, passing: 0, defending: -6 },
};

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

function baseFromOverall(overall: number): PlayerAttributes {
  const o = clamp(overall, 40, 99);
  return {
    passing: o,
    dribbling: o,
    shooting: o,
    defending: o,
    goalkeeping: o,
    intelligence: o,
    pace: o,
    stamina: o,
  };
}

function applyPositionMods(
  base: PlayerAttributes,
  position: string,
): PlayerAttributes {
  const mods = POSITION_MODS[position] ?? POSITION_MODS[position.slice(0, 2)] ?? {};
  return {
    passing: clamp(base.passing + (mods.passing ?? 0), 1, 99),
    dribbling: clamp(base.dribbling + (mods.dribbling ?? 0), 1, 99),
    shooting: clamp(base.shooting + (mods.shooting ?? 0), 1, 99),
    defending: clamp(base.defending + (mods.defending ?? 0), 1, 99),
    goalkeeping: clamp(base.goalkeeping + (mods.goalkeeping ?? 0), 1, 99),
    intelligence: clamp(base.intelligence + (mods.intelligence ?? 0), 1, 99),
    pace: clamp(base.pace + (mods.pace ?? 0), 1, 99),
    stamina: clamp(base.stamina + (mods.stamina ?? 0), 1, 99),
  };
}

/** Resolve a single player's overall from config overrides or team default. */
export function resolvePlayerOverall(
  slot: LineupSlot,
  side: Side,
  teamOverall: number,
  overrides?: Record<string, number>,
): number {
  const override = overrides?.[slot.playerId];
  if (override !== undefined) return clamp(override, 40, 99);
  // Slight variation by shirt number so XI isn't flat when only team overall is known.
  const spread = ((slot.number % 5) - 2) * 1.5;
  return clamp(teamOverall + spread, 40, 99);
}

/** Derive live attributes for one lineup slot. */
export function derivePlayerAttributes(
  slot: LineupSlot,
  side: Side,
  teamOverall: number,
  overrides?: Record<string, number>,
): PlayerAttributes {
  const overall = resolvePlayerOverall(slot, side, teamOverall, overrides);
  const base = baseFromOverall(overall);
  const attrs = applyPositionMods(base, slot.position);
  if (slot.position === "GK") {
    attrs.goalkeeping = clamp(attrs.goalkeeping + 8, 1, 99);
  }
  return attrs;
}

/** Tactic bias multipliers for AI risk and pressing intensity. */
export function tacticBias(tactic: LiveTactic): {
  shoot: number;
  passForward: number;
  press: number;
  dribble: number;
} {
  switch (tactic) {
    case "offensive":
      return { shoot: 1.25, passForward: 1.2, press: 1.1, dribble: 1.15 };
    case "defensive":
      return { shoot: 0.75, passForward: 0.85, press: 0.7, dribble: 0.8 };
    default:
      return { shoot: 1, passForward: 1, press: 1, dribble: 1 };
  }
}

/** Whether a position code is a goalkeeper. */
export function isGoalkeeperPosition(position: string): boolean {
  return position === "GK";
}
