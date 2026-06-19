/**
 * Squad chemistry — a placement-quality signal (0–100%) derived purely from
 * where each player is fielded versus their natural position (GAME-GUIDE §6,
 * MVP §4.5). Pure and deterministic; the resulting % feeds `effectiveStrength`
 * (`src/strength.ts`) as a −3…+3 rating bonus.
 *
 * Scoring follows the rules verbatim: full credit for the exact role, partial
 * for an adjacent role, little for an unrelated one. Chemistry % is the mean
 * fit across the XI, scaled to 0–100.
 */

import { FIT_ADJACENT, FIT_EXACT, FIT_UNRELATED } from "./constants.js";

/** Canonical role buckets that position codes collapse into. */
export type Role = "GK" | "FB" | "CB" | "DM" | "CM" | "AM" | "W" | "ST";

/**
 * Normalize a raw position code (e.g. "RCB", "LWB", "CF") to a canonical role.
 * Side prefixes (R/L) are stripped; unknown codes return `null` (treated as an
 * unrelated fit so a typo never silently scores full credit).
 */
export function canonicalRole(position: string): Role | null {
  const p = position.trim().toUpperCase();
  if (p === "GK") return "GK";
  // Strip a single leading side qualifier (R/L) before matching the core role.
  const core = p.replace(/^(R|L)(?=[A-Z])/, "");

  if (core === "WB" || core === "RB" || core === "LB" || core === "B" || core === "FB")
    return "FB";
  if (core === "CB" || core === "RCB" || core === "LCB") return "CB";
  if (core === "DM" || core === "CDM" || core === "DMF") return "DM";
  if (core === "CM" || core === "RCM" || core === "LCM" || core === "MF" || core === "M")
    return "CM";
  if (core === "AM" || core === "CAM" || core === "AMF") return "AM";
  if (core === "W" || core === "RW" || core === "LW" || core === "WF" || core === "WG")
    return "W";
  if (core === "ST" || core === "CF" || core === "F" || core === "FW") return "ST";
  return null;
}

/** Adjacency graph between canonical roles (symmetric; GK is exact-only). */
export const ROLE_ADJACENCY: Record<Role, ReadonlySet<Role>> = {
  GK: new Set<Role>(),
  FB: new Set<Role>(["CB", "W"]),
  CB: new Set<Role>(["FB", "DM"]),
  DM: new Set<Role>(["CB", "CM"]),
  CM: new Set<Role>(["DM", "AM"]),
  AM: new Set<Role>(["CM", "W", "ST"]),
  W: new Set<Role>(["AM", "ST", "FB"]),
  ST: new Set<Role>(["AM", "W"]),
};

/**
 * Fit of a player (natural position) fielded at `assigned`:
 * exact role → 1.0, adjacent role → 0.5, otherwise → 0.15.
 */
export function positionFit(natural: string, assigned: string): number {
  const nat = canonicalRole(natural);
  const asg = canonicalRole(assigned);
  if (nat === null || asg === null) return FIT_UNRELATED;
  if (nat === asg) return FIT_EXACT;
  if (ROLE_ADJACENCY[nat].has(asg)) return FIT_ADJACENT;
  return FIT_UNRELATED;
}

/**
 * Chemistry % for a lineup: the mean position-fit across all placements, scaled
 * to 0–100. A perfectly-placed XI → 100; an empty lineup → 0.
 */
export function chemistryPercent(
  placements: { natural: string; assigned: string }[],
): number {
  if (placements.length === 0) return 0;
  const total = placements.reduce(
    (sum, p) => sum + positionFit(p.natural, p.assigned),
    0,
  );
  return (total / placements.length) * 100;
}
