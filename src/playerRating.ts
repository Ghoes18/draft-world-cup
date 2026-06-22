/**
 * Player overall (OVR) — FIFA-style general rating for display and team strength.
 *
 * Prefers API-provided `overall`; falls back to legacy `force` scaling only when
 * the catalog was built without an explicit rating field.
 */

import type { PlayerCard } from "./catalog.js";
import { FORCE_TO_RATING } from "./constants.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Map raw force (0–255) to 0–100 rating scale. */
export function forceToRating(force: number): number {
  return clamp(Math.round(force * FORCE_TO_RATING), 0, 100);
}

/** General player overall used in UI and lineup strength aggregation. */
export function playerOverall(player: PlayerCard): number {
  if (typeof player.overall === "number" && Number.isFinite(player.overall)) {
    return clamp(player.overall, 0, 100);
  }
  return forceToRating(player.force);
}
