/**
 * Maps a `PlayerTier` (resolved by the engine's `playerTier()`) to the CSS
 * classes defined in `globals.css`. Kept in one place so the avatar, pool row,
 * and pitch token all render tiers identically.
 */

import type { PlayerTier } from "7a0-engine";

/** Class for a player name label (gradient/coloured text). */
export function tierNameClass(tier: PlayerTier): string {
  return tier === "legend" ? "player-name--legend" : `player-name--tier-${tier}`;
}

/** Class for a circular avatar frame (border + glow). */
export function tierFrameClass(tier: PlayerTier): string {
  return tier === "legend"
    ? "player-avatar--legend"
    : `player-avatar--tier-${tier}`;
}

/**
 * Optional foil-sweep class for the avatar. Reserved for the legend classes —
 * legend (rose sweep) and icon (mono sweep); every other tier gets no sweep.
 */
export function tierFoilClass(tier: PlayerTier): string | null {
  switch (tier) {
    case "legend":
      return "holo-foil holo-foil--legend";
    case "icon":
      return "holo-foil holo-foil--mono";
    default:
      return null;
  }
}
