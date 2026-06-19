/**
 * Derive team attack/defense/overall from the chosen XI — live 7a0 model.
 *
 * Each player contributes their `force`; fielded position sets attack/defense
 * weights. Chemistry and tactics apply afterward via `effectiveStrength`.
 */

import { getPlayer, type SquadCatalog } from "./catalog.js";
import { FORCE_TO_RATING } from "./constants.js";
import type { TeamStrength } from "./engine.js";
import { attackWeight, defenseWeight } from "./positions.js";
import { buildStateToLineup, type BuildState } from "./roll.js";
import type { LineupSlot } from "./types.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Map raw force (0–255) to engine rating scale. */
export function forceToRating(force: number): number {
  return clamp(Math.round(force * FORCE_TO_RATING), 0, 100);
}

function weightedAverage(
  values: number[],
  weights: number[],
): number {
  let sum = 0;
  let wSum = 0;
  for (let i = 0; i < values.length; i++) {
    const w = weights[i]!;
    if (w <= 0) continue;
    sum += values[i]! * w;
    wSum += w;
  }
  if (wSum === 0) return 0;
  return sum / wSum;
}

/**
 * Aggregate `TeamStrength` from 11 lineup slots and player forces.
 * Uses fielded `slot.position` for weighting (not natural position).
 */
export function lineupToTeamStrength(
  catalog: SquadCatalog,
  lineup: LineupSlot[],
): TeamStrength {
  if (lineup.length !== 11) {
    throw new Error(`lineupToTeamStrength: expected 11 slots, got ${lineup.length}`);
  }

  const ratings: number[] = [];
  const atkWeights: number[] = [];
  const defWeights: number[] = [];

  for (const slot of lineup) {
    const player = getPlayer(catalog, slot.playerId);
    const rating = forceToRating(player.force);
    ratings.push(rating);
    atkWeights.push(attackWeight(slot.position));
    defWeights.push(defenseWeight(slot.position));
  }

  const overall =
    ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const attack = weightedAverage(ratings, atkWeights);
  const defense = weightedAverage(ratings, defWeights);

  return {
    overall: Math.round(overall),
    attack: Math.round(attack || overall),
    defense: Math.round(defense || overall),
  };
}

/** Derive strength from an in-progress or complete Build state. */
export function buildStateToTeamStrength(
  catalog: SquadCatalog,
  state: BuildState,
): TeamStrength {
  return lineupToTeamStrength(catalog, buildStateToLineup(catalog, state));
}

/** Partial XI preview when Build is incomplete (filled slots only). */
export function partialBuildToTeamStrength(
  catalog: SquadCatalog,
  state: BuildState,
): TeamStrength | null {
  const ratings: number[] = [];
  const atkWeights: number[] = [];
  const defWeights: number[] = [];

  for (const slot of state.slots) {
    if (!slot.selectedPlayerId) continue;
    const player = getPlayer(catalog, slot.selectedPlayerId);
    const rating = forceToRating(player.force);
    ratings.push(rating);
    atkWeights.push(attackWeight(slot.position));
    defWeights.push(defenseWeight(slot.position));
  }

  if (ratings.length === 0) return null;

  const overall = ratings.reduce((a, b) => a + b, 0) / ratings.length;
  const attack = weightedAverage(ratings, atkWeights);
  const defense = weightedAverage(ratings, defWeights);

  return {
    overall: Math.round(overall),
    attack: Math.round(attack || overall),
    defense: Math.round(defense || overall),
  };
}
