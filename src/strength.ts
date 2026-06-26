/**
 * Effective team strength — applies tactic modifiers to a team's base ratings,
 * producing the `TeamStrength` the engine consumes (MVP §4.6; GAME-GUIDE §7).
 * Pure and deterministic, so it runs server-side in front of `simulateMatch`
 * for online + daily.
 *
 *   effective = base + tacticDeltas(tactic)   // attack/defense only
 */

import { TACTIC_DELTA, type Tactic } from "./constants.js";
import type { TeamStrength } from "./engine.js";

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
  /** Pre-match tactic. Defaults to "balanced" (no change). */
  tactic?: Tactic;
  /** Squad-chemistry bonus (0…+3), added to attack/midfield/defense. See src/synergy.ts. */
  chemistryBonus?: number;
  /** Legend bonus, added to overall. See src/synergy.ts. */
  legendBonus?: number;
}

/**
 * Apply chemistry then tactics to base ratings (CLAUDE.md order). Chemistry
 * lifts attack/midfield/defense together; the tactic then trades δ between
 * attack and defense (a within-match trade-off, overall unaffected); the legend
 * bonus lifts overall (feeding both display and the penalty-shootout model).
 */
export function effectiveStrength(
  base: TeamStrength,
  opts: StrengthModifiers = {},
): TeamStrength {
  const chem = opts.chemistryBonus ?? 0;
  const legend = opts.legendBonus ?? 0;
  const { attack: da, defense: dd } = tacticDeltas(opts.tactic ?? "balanced");
  return {
    attack: base.attack + chem + da,
    midfield: base.midfield + chem,
    defense: base.defense + chem + dd,
    overall: base.overall + legend,
  };
}
