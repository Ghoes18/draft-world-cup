/**
 * Player tier — the single source of truth for collectible "rarity" styling and
 * placement effects. Pure and server-safe so the UI never re-derives it (same
 * discipline as `playerOverall()` and the position canonicalizer).
 *
 * Precedence: curated legends win over rating. A legend flagged as a retired
 * historical great is an `icon` (animated black-&-white); other legends are
 * `legend` (gold). Everyone else is bucketed by overall, FIFA-style.
 */

import type { PlayerCard } from "./catalog.js";
import { legendEntryForName } from "./legends.js";
import { playerOverall } from "./playerRating.js";

/** Minimum overall for the elite tier — also gates headshot photos in the catalog. */
export const ELITE_MIN_OVERALL = 85;

export type PlayerTier =
  | "bronze"
  | "silver"
  | "gold"
  | "elite"
  | "legend"
  | "icon";

/**
 * Resolve the display/effect tier for a player. `team` and `force` are optional
 * so lightweight views (e.g. boss lineup rows) that only carry name + overall
 * can resolve tiers too; `overall` alone is enough when present.
 */
export function playerTier(player: {
  name: string;
  team?: string;
  overall?: number;
  force?: number;
}): PlayerTier {
  const legend = legendEntryForName(player.name, player.team);
  if (legend) return legend.icon ? "icon" : "legend";

  const ovr = playerOverall({
    overall: player.overall,
    force: player.force ?? 0,
  } as PlayerCard);
  if (ovr >= ELITE_MIN_OVERALL) return "elite";
  if (ovr >= 75) return "gold";
  if (ovr >= 65) return "silver";
  return "bronze";
}
