/**
 * Cosmetic filler events — re-exported via attack clusters (MVP §4.1).
 * Frequency tracks λ; clusters never change the score.
 */

import type { Rng } from "../rng.js";
import type { LineupSlot, MatchEvent, Side } from "../types.js";
import { buildAttackClusters } from "./clusters.js";

/** @deprecated Use buildAttackClusters directly. Kept for import stability. */
export function buildFiller(
  side: Side,
  lambda: number,
  lineup: LineupSlot[],
  rng: Rng,
): MatchEvent[] {
  return buildAttackClusters(side, lambda, lineup, rng);
}

export { buildPassChain, outfield, attackSpot } from "./clusters.js";
