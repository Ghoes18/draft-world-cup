/**
 * Effective team strength — applies chemistry and tactics modifiers to a team's
 * base ratings, producing the `TeamStrength` the engine consumes (MVP §4.5,
 * §4.6; GAME-GUIDE §6, §7). Pure and deterministic, so it runs server-side in
 * front of `simulateMatch` for online + daily.
 *
 *   effective = base
 *     + chemistryBonus(chem%)   // applied to attack, defense AND overall
 *     + tacticDeltas(tactic)    // applied to attack and your defense only
 */

import { CHEMISTRY_RANGE, TACTIC_DELTA, type Tactic } from "./constants.js";
import type { TeamStrength } from "./engine.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/**
 * Chemistry rating bonus: `round((chem% − 50) / 100 × CHEMISTRY_RANGE)`.
 * 0% → −3, 50% → 0 (neutral), 100% → +3. Input clamped to [0, 100].
 */
export function chemistryBonus(chemistryPct: number): number {
  const pct = clamp(chemistryPct, 0, 100);
  return Math.round(((pct - 50) / 100) * CHEMISTRY_RANGE);
}

/** Attack/defense deltas for a tactic (δ traded between the two). */
export function tacticDeltas(tactic: Tactic): {
  attack: number;
  defense: number;
} {
  switch (tactic) {
    case "offensive":
      return { attack: TACTIC_DELTA, defense: -TACTIC_DELTA };
    case "defensive":
      return { attack: -TACTIC_DELTA, defense: TACTIC_DELTA };
    case "balanced":
      return { attack: 0, defense: 0 };
  }
}

export interface StrengthModifiers {
  /** Chemistry %, 0–100. Defaults to 50 (the neutral, zero-bonus point). */
  chemistryPct?: number;
  /** Pre-match tactic. Defaults to "balanced" (no change). */
  tactic?: Tactic;
}

/**
 * Apply chemistry + tactics to base ratings. Chemistry shifts attack, defense
 * and overall together; the tactic trades δ between attack and defense (overall
 * is unaffected by tactics — it is a within-match trade-off).
 */
export function effectiveStrength(
  base: TeamStrength,
  opts: StrengthModifiers = {},
): TeamStrength {
  const bonus = chemistryBonus(opts.chemistryPct ?? 50);
  const { attack: da, defense: dd } = tacticDeltas(opts.tactic ?? "balanced");
  return {
    attack: base.attack + bonus + da,
    defense: base.defense + bonus + dd,
    overall: base.overall + bonus,
  };
}
