/**
 * Default formation anchors (4-3-3) in the unified top-down space.
 *
 * Real lineups come from the build screen (player ids, shirt numbers, chosen
 * positions); M1 has no player data, so this provides a neutral XI for the
 * engine/timeline/CLI to operate on. Anchors are in the home-attacking-right
 * frame and mirrored on x for the away side.
 */

import type { LineupSlot, Side, Vec2 } from "./types.js";

interface AnchorSpec {
  position: string;
  /** Home-frame anchor (x = own-goal→opponent-goal). */
  anchor: Vec2;
}

// 4-3-3, home attacking toward x = 1.
const FORMATION_433: AnchorSpec[] = [
  { position: "GK", anchor: { x: 0.05, y: 0.5 } },
  { position: "RB", anchor: { x: 0.25, y: 0.15 } },
  { position: "RCB", anchor: { x: 0.2, y: 0.38 } },
  { position: "LCB", anchor: { x: 0.2, y: 0.62 } },
  { position: "LB", anchor: { x: 0.25, y: 0.85 } },
  { position: "RCM", anchor: { x: 0.45, y: 0.3 } },
  { position: "CM", anchor: { x: 0.42, y: 0.5 } },
  { position: "LCM", anchor: { x: 0.45, y: 0.7 } },
  { position: "RW", anchor: { x: 0.72, y: 0.2 } },
  { position: "ST", anchor: { x: 0.78, y: 0.5 } },
  { position: "LW", anchor: { x: 0.72, y: 0.8 } },
];

/** Build a neutral 4-3-3 XI for a side, with shirt numbers 1..11. */
export function defaultLineup(side: Side): LineupSlot[] {
  return FORMATION_433.map((spec, i) => {
    const x = side === "home" ? spec.anchor.x : 1 - spec.anchor.x;
    return {
      playerId: `${side}-${i + 1}`,
      number: i + 1,
      position: spec.position,
      anchor: { x, y: spec.anchor.y },
    };
  });
}
