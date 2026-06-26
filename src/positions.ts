/**
 * Attack/defense weights for lineup aggregation (`src/lineupStrength.ts`).
 *
 * A fielded position contributes to a side's attack and defense in proportion
 * to how advanced the role is: a striker is all attack, a centre-back all
 * defense, midfielders split. Weights are keyed by the 8 canonical roles, and
 * any position code (coarse "CB"/"ST" or detail "RCB"/"LST"/"RWB") is collapsed
 * to its role via `anyPositionRole` — the SAME normalizer chemistry uses, so the
 * two systems can never disagree about what a code means.
 */

import { anyPositionRole, type Role } from "./chemistry.js";

/** How much each role contributes to the side's attack rating (0…1). */
const ATTACK_BY_ROLE: Record<Role, number> = {
  GK: 0,
  FB: 0,
  CB: 0,
  DM: 0.2,
  CM: 0.5,
  AM: 0.8,
  W: 1,
  ST: 1,
};

/** How much each role contributes to the side's defense rating (0…1). */
const DEFENSE_BY_ROLE: Record<Role, number> = {
  GK: 1,
  FB: 1,
  CB: 1,
  DM: 0.8,
  CM: 0.5,
  AM: 0.2,
  W: 0,
  ST: 0,
};

/** Unknown codes weigh like a balanced central midfielder. */
const FALLBACK_ROLE: Role = "CM";

export function attackWeight(position: string): number {
  return ATTACK_BY_ROLE[anyPositionRole(position) ?? FALLBACK_ROLE];
}

export function defenseWeight(position: string): number {
  return DEFENSE_BY_ROLE[anyPositionRole(position) ?? FALLBACK_ROLE];
}
