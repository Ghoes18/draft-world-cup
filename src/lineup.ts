/**
 * Default formation anchors in the unified top-down space.
 *
 * Real lineups come from the build screen (player ids, shirt numbers, chosen
 * positions); M1 has no player data, so this provides a neutral XI for the
 * engine/timeline/CLI to operate on. Anchors are in the home-attacking-right
 * frame and mirrored on x for the away side.
 */

import {
  DEFAULT_FORMATION_ID,
  formationAnchors as anchorsForFormation,
} from "./formations.js";
import type { LineupSlot, Side } from "./types.js";

export { formationAnchors } from "./formations.js";

/** Build a neutral XI for a side, with shirt numbers 1..11. */
export function defaultLineup(
  side: Side,
  formationId: string = DEFAULT_FORMATION_ID,
): LineupSlot[] {
  const specs = anchorsForFormation(formationId);
  return specs.map((spec, i) => {
    const x = side === "home" ? spec.anchor.x : 1 - spec.anchor.x;
    return {
      playerId: `${side}-${i + 1}`,
      number: i + 1,
      position: spec.position,
      anchor: { x, y: spec.anchor.y },
    };
  });
}
