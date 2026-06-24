/**
 * Detailed position model — 28 precise football positions with role/sub-role taxonomy.
 *
 * Solves the problem of coarse "CB" / "CM" / "ST" labels that erase tactical
 * distinctions (e.g., left-back vs right-back, defensive mid vs box-to-box,
 * left winger vs right winger, winger vs inside forward).
 *
 * Three granularity levels:
 *   - family: 5 buckets (GK, DEF, MID, FWD) — for UI grouping
 *   - role: 8 buckets (GK, FB, CB, DM, CM, AM, W, ST) — chemistry canonical
 *   - detail: 28 precise slots — for accurate rendering, fit scoring, pitch placement
 *
 * Each detail position maps to its chemistry role AND carries side + lateral tags.
 */

/** The 28 detailed football positions. */
export type PosDetail =
  // Goalkeeper
  | "GK"
  // Full-backs (defensive)
  | "RB"
  | "LB"
  // Wing-backs (attacking full-backs)
  | "RWB"
  | "LWB"
  // Centre-backs
  | "RCB"
  | "LCB"
  | "CB"
  | "SW"  // Sweeper / Libero
  // Defensive midfielders
  | "CDM"  // Holding midfielder
  | "CDM_DEEP"  // Deep-lying playmaker (regista)
  // Central midfielders
  | "CM"    // Box-to-box / general CM
  | "RCM"
  | "LCM"
  | "CM_LEFT"   // Mezzala left
  | "CM_RIGHT"  // Mezzala right
  // Attacking midfielders
  | "CAM"    // Classic no. 10
  | "RAM"
  | "LAM"
  | "CAM_LEFT"   // Trequartista drifting left
  | "CAM_RIGHT"  // Trequartista drifting right
  // Wingers / wide midfield
  | "RW"     // Right winger (stays wide)
  | "LW"     // Left winger (stays wide)
  | "RW_INSIDE"  // Right inside forward (cuts inside)
  | "LW_INSIDE"  // Left inside forward (cuts inside)
  | "RM"     // Right midfield — more defensive/wide
  | "LM"     // Left midfield — more defensive/wide
  // Forwards
  | "ST"     // Striker — central
  | "RST"    // Right striker (in a pair)
  | "LST"    // Left striker (in a pair)
  | "CF"     // Centre forward — drops deeper than ST
  | "CF_FALSE9"  // False 9 — drops into midfield
  | "CF_SUPPORT"  // Support striker (second striker);

/** Coarse tactical families for UI grouping. */
export type PosFamily = "GK" | "DEF" | "MID" | "FWD";

/** Vertical zone on the pitch. */
export type VerticalZone = "defensive" | "middle" | "attacking";

/** Horizontal side. */
export type PosSide = "L" | "C" | "R";

/** Position metadata. */
export interface PositionDetail {
  code: PosDetail;
  label: string;
  shortLabel: string;
  family: PosFamily;
  role: "GK" | "FB" | "CB" | "DM" | "CM" | "AM" | "W" | "ST";
  zone: VerticalZone;
  side: PosSide;
  laterally: "wide" | "central";
}

/** Full metadata table for all 28 detailed positions. */
export const POSITION_DETAILS: Record<PosDetail, PositionDetail> = {
  // — Goalkeeper —
  GK:              { code: "GK",              label: "Goalkeeper",            shortLabel: "GK",   family: "GK",  role: "GK", zone: "defensive",  side: "C",  laterally: "central" },

  // — Full-backs —
  RB:              { code: "RB",              label: "Right Back",            shortLabel: "RB",   family: "DEF", role: "FB", zone: "defensive",  side: "R",  laterally: "wide" },
  LB:              { code: "LB",              label: "Left Back",             shortLabel: "LB",   family: "DEF", role: "FB", zone: "defensive",  side: "L",  laterally: "wide" },

  // — Wing-backs —
  RWB:             { code: "RWB",             label: "Right Wing-Back",       shortLabel: "RWB",  family: "DEF", role: "FB", zone: "defensive",  side: "R",  laterally: "wide" },
  LWB:             { code: "LWB",             label: "Left Wing-Back",        shortLabel: "LWB",  family: "DEF", role: "FB", zone: "defensive",  side: "L",  laterally: "wide" },

  // — Centre-backs —
  RCB:             { code: "RCB",             label: "Right Centre-Back",     shortLabel: "RCB",  family: "DEF", role: "CB", zone: "defensive",  side: "R",  laterally: "central" },
  LCB:             { code: "LCB",             label: "Left Centre-Back",      shortLabel: "LCB",  family: "DEF", role: "CB", zone: "defensive",  side: "L",  laterally: "central" },
  CB:              { code: "CB",              label: "Centre-Back",           shortLabel: "CB",   family: "DEF", role: "CB", zone: "defensive",  side: "C",  laterally: "central" },
  SW:              { code: "SW",              label: "Sweeper",               shortLabel: "SW",   family: "DEF", role: "CB", zone: "defensive",  side: "C",  laterally: "central" },

  // — Defensive midfielders —
  CDM:             { code: "CDM",             label: "Defensive Midfielder",   shortLabel: "CDM",  family: "MID", role: "DM", zone: "defensive",  side: "C",  laterally: "central" },
  CDM_DEEP:        { code: "CDM_DEEP",        label: "Deep Playmaker",        shortLabel: "DLP",  family: "MID", role: "DM", zone: "defensive",  side: "C",  laterally: "central" },

  // — Central midfielders —
  CM:              { code: "CM",              label: "Central Midfielder",     shortLabel: "CM",   family: "MID", role: "CM", zone: "middle",     side: "C",  laterally: "central" },
  RCM:             { code: "RCM",             label: "Right Central Mid",      shortLabel: "RCM",  family: "MID", role: "CM", zone: "middle",     side: "R",  laterally: "central" },
  LCM:             { code: "LCM",             label: "Left Central Mid",       shortLabel: "LCM",  family: "MID", role: "CM", zone: "middle",     side: "L",  laterally: "central" },
  CM_RIGHT:        { code: "CM_RIGHT",        label: "Midfielder — Right",     shortLabel: "MR",   family: "MID", role: "CM", zone: "middle",     side: "R",  laterally: "central" },
  CM_LEFT:         { code: "CM_LEFT",         label: "Midfielder — Left",      shortLabel: "ML",   family: "MID", role: "CM", zone: "middle",     side: "L",  laterally: "central" },

  // — Attacking midfielders —
  CAM:             { code: "CAM",             label: "Attacking Midfielder",    shortLabel: "CAM",  family: "MID", role: "AM", zone: "attacking",  side: "C",  laterally: "central" },
  RAM:             { code: "RAM",             label: "Right Attacking Mid",    shortLabel: "RAM",  family: "MID", role: "AM", zone: "attacking",  side: "R",  laterally: "central" },
  LAM:             { code: "LAM",             label: "Left Attacking Mid",     shortLabel: "LAM",  family: "MID", role: "AM", zone: "attacking",  side: "L",  laterally: "central" },
  CAM_RIGHT:       { code: "CAM_RIGHT",       label: "Playmaker — Right",      shortLabel: "AMR",  family: "MID", role: "AM", zone: "attacking",  side: "R",  laterally: "central" },
  CAM_LEFT:        { code: "CAM_LEFT",        label: "Playmaker — Left",       shortLabel: "AML",  family: "MID", role: "AM", zone: "attacking",  side: "L",  laterally: "central" },

  // — Wingers / wide midfield —
  RW:              { code: "RW",              label: "Right Winger",           shortLabel: "RW",   family: "FWD", role: "W",  zone: "attacking",  side: "R",  laterally: "wide" },
  LW:              { code: "LW",              label: "Left Winger",            shortLabel: "LW",   family: "FWD", role: "W",  zone: "attacking",  side: "L",  laterally: "wide" },
  RW_INSIDE:       { code: "RW_INSIDE",       label: "Right Inside Forward",   shortLabel: "RIF",  family: "FWD", role: "W",  zone: "attacking",  side: "R",  laterally: "wide" },
  LW_INSIDE:       { code: "LW_INSIDE",       label: "Left Inside Forward",    shortLabel: "LIF",  family: "FWD", role: "W",  zone: "attacking",  side: "L",  laterally: "wide" },
  RM:              { code: "RM",              label: "Right Midfield",         shortLabel: "RM",   family: "MID", role: "W",  zone: "middle",     side: "R",  laterally: "wide" },
  LM:              { code: "LM",              label: "Left Midfield",          shortLabel: "LM",   family: "MID", role: "W",  zone: "middle",     side: "L",  laterally: "wide" },

  // — Forwards —
  ST:              { code: "ST",              label: "Striker",               shortLabel: "ST",   family: "FWD", role: "ST", zone: "attacking",  side: "C",  laterally: "central" },
  RST:             { code: "RST",             label: "Right Striker",          shortLabel: "RST",  family: "FWD", role: "ST", zone: "attacking",  side: "R",  laterally: "central" },
  LST:             { code: "LST",             label: "Left Striker",           shortLabel: "LST",  family: "FWD", role: "ST", zone: "attacking",  side: "L",  laterally: "central" },
  CF:              { code: "CF",              label: "Centre Forward",         shortLabel: "CF",   family: "FWD", role: "ST", zone: "attacking",  side: "C",  laterally: "central" },
  CF_FALSE9:       { code: "CF_FALSE9",       label: "False Nine",             shortLabel: "F9",   family: "FWD", role: "ST", zone: "middle",     side: "C",  laterally: "central" },
  CF_SUPPORT:      { code: "CF_SUPPORT",      label: "Support Striker",        shortLabel: "SS",   family: "FWD", role: "ST", zone: "attacking",  side: "C",  laterally: "central" },
};

/** All 28 detail codes (for iteration / validation). */
export const ALL_POS_DETAIL: readonly PosDetail[] = Object.keys(POSITION_DETAILS) as PosDetail[];

// ─────────────────────────────────────────────────────────────────────────────
// Coarse code → Detail position mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a coarse catalog code (e.g. "CB", "CM", "ST") to a list of plausible
 * detailed positions. Used when the catalog only has coarse labels and we need
 * to expand for UI rendering or pitch placement.
 *
 * Returns multiple positions when ambiguous (e.g. "CM" → CM, RCM, LCM).
 */
export function expandCoarseToDetail(coarse: string): readonly PosDetail[] {
  const p = coarse.trim().toUpperCase();
  switch (p) {
    case "GK":
      return ["GK"];
    case "RB":
      return ["RB", "RWB"];
    case "LB":
      return ["LB", "LWB"];
    case "RWB":
    case "WB":
      return ["RWB"];
    case "LWB":
      return ["LWB"];
    case "RCB":
      return ["RCB"];
    case "LCB":
      return ["LCB"];
    case "CB":
      return ["RCB", "LCB", "CB"];
    case "SW":
    case "SWEEPER":
    case "LIBERO":
      return ["SW"];
    case "CDM":
    case "DM":
    case "VOL":
      return ["CDM", "CDM_DEEP"];
    case "CM":
    case "MF":
      return ["CM", "RCM", "LCM", "CM_LEFT", "CM_RIGHT"];
    case "RCM":
      return ["RCM", "CM_RIGHT"];
    case "LCM":
      return ["LCM", "CM_LEFT"];
    case "CAM":
    case "AM":
    case "MEI":
    case "PLAYMAKER":
      return ["CAM", "RAM", "LAM"];
    case "RAM":
      return ["RAM", "CAM_RIGHT"];
    case "LAM":
      return ["LAM", "CAM_LEFT"];
    case "RW":
    case "RWF":
    case "PD":
      return ["RW", "RW_INSIDE"];
    case "LW":
    case "LWF":
    case "PE":
      return ["LW", "LW_INSIDE"];
    case "RM":
    case "ME":
      return ["RM", "CM_RIGHT"];
    case "LM":
    case "MD":
      return ["LM", "CM_LEFT"];
    case "ST":
    case "FW":
    case "CA":
      return ["ST", "RST", "LST"];
    case "RST":
      return ["RST"];
    case "LST":
      return ["LST"];
    case "CF":
      return ["CF", "CF_FALSE9", "CF_SUPPORT"];
    case "F9":
    case "FALSE9":
      return ["CF_FALSE9"];
    case "SS":
    case "SECONDSTRIKER":
      return ["CF_SUPPORT"];
    default:
      return [p as PosDetail];
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Detail → Coarse (reverse mapping)
// ─────────────────────────────────────────────────────────────────────────────

/** Collapse a detail position back to its canonical chemistry role. */
export function detailToRole(detail: PosDetail): "GK" | "FB" | "CB" | "DM" | "CM" | "AM" | "W" | "ST" {
  return POSITION_DETAILS[detail].role;
}

/** Get the family for a detail position. */
export function detailToFamily(detail: PosDetail): PosFamily {
  return POSITION_DETAILS[detail].family;
}

/** Get the side for a detail position. */
export function detailToSide(detail: PosDetail): PosSide {
  return POSITION_DETAILS[detail].side;
}

/** Get the vertical zone for a detail position. */
export function detailToZone(detail: PosDetail): VerticalZone {
  return POSITION_DETAILS[detail].zone;
}

// ─────────────────────────────────────────────────────────────────────────────
// Fit scoring — side-aware, granular
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fit score between a player's natural (detail) position and an assigned slot.
 *
 * Returns 0.0–1.0 with side awareness:
 *   - exact match (same code): 1.0
 *   - same role, same side: 0.85
 *   - same role, different side: 0.55
 *   - adjacent role, same side: 0.45
 *   - adjacent role, different side: 0.30
 *   - unrelated: 0.10
 *
 * This replaces the coarse `positionFit` from chemistry.ts when the catalog
 * has detail-level positions.
 */
export function detailPositionFit(natural: PosDetail, assigned: PosDetail): number {
  if (natural === assigned) return 1.0;

  const natMeta = POSITION_DETAILS[natural];
  const asgMeta = POSITION_DETAILS[assigned];

  // GK is exact-only
  if (natMeta.role === "GK" || asgMeta.role === "GK") {
    return natMeta.role === asgMeta.role ? 1.0 : 0.05;
  }

  const sameRole = natMeta.role === asgMeta.role;
  const sameSide = natMeta.side === asgMeta.side;

  if (sameRole) {
    if (sameSide) return 0.85;
    return 0.55;
  }

  // Check role adjacency (reuse chemistry graph)
  const adjacent = isAdjacentRole(natMeta.role, asgMeta.role);
  if (adjacent) {
    if (sameSide) return 0.45;
    return 0.28;
  }

  return 0.10;
}

/** Whether two roles are adjacent in the chemistry graph. */
function isAdjacentRole(
  a: "GK" | "FB" | "CB" | "DM" | "CM" | "AM" | "W" | "ST",
  b: "GK" | "FB" | "CB" | "DM" | "CM" | "AM" | "W" | "ST",
): boolean {
  if (a === "GK" || b === "GK") return false;
  const adjacency: Record<string, ReadonlySet<string>> = {
    FB: new Set(["CB", "W"]),
    CB: new Set(["FB", "DM"]),
    DM: new Set(["CB", "CM"]),
    CM: new Set(["DM", "AM"]),
    AM: new Set(["CM", "W", "ST"]),
    W: new Set(["AM", "ST", "FB"]),
    ST: new Set(["AM", "W"]),
  };
  return adjacency[a]?.has(b) ?? false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Transfermarkt label → Detail mapping
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Map a Transfermarkt English label to a precise detail position.
 * This is the fine-grained replacement for the coarse TRANSFERMARKT_POSITION_MAP.
 */
export function transfermarktLabelToDetail(label: string): PosDetail | null {
  const normalized = label.trim().toLowerCase().replace(/\s+/g, " ");

  const map: Record<string, PosDetail> = {
    // Goalkeeper
    "goalkeeper": "GK",
    "keeper": "GK",

    // Full-backs
    "right back": "RB",
    "left back": "LB",
    "right full back": "RB",
    "left full back": "LB",

    // Wing-backs
    "right wing back": "RWB",
    "left wing back": "LWB",
    "right wing-back": "RWB",
    "left wing-back": "LWB",

    // Centre-backs
    "centre back": "CB",
    "center back": "CB",
    "centre-back": "CB",
    "center-back": "CB",
    "right centre back": "RCB",
    "left centre back": "LCB",
    "right center back": "RCB",
    "left center back": "LCB",
    "right centre-back": "RCB",
    "left centre-back": "LCB",
    "right center-back": "RCB",
    "left center-back": "LCB",
    "sweeper": "SW",
    "libero": "SW",

    // Defensive midfield
    "defensive midfield": "CDM",
    "defensive midfielder": "CDM",
    "holding midfielder": "CDM",
    "deep lying playmaker": "CDM_DEEP",
    "regista": "CDM_DEEP",

    // Central midfield
    "central midfield": "CM",
    "central midfielder": "CM",
    "box to box midfielder": "CM",
    "box-to-box midfielder": "CM",
    "right central midfield": "RCM",
    "left central midfield": "LCM",
    "right central midfielder": "RCM",
    "left central midfielder": "LCM",
    "right midfield": "RM",
    "left midfield": "LM",
    "right midfielder": "RM",
    "left midfielder": "LM",
    "mezzala": "CM",
    "mezzala left": "CM_LEFT",
    "mezzala right": "CM_RIGHT",

    // Attacking midfield
    "attacking midfield": "CAM",
    "attacking midfielder": "CAM",
    "playmaker": "CAM",
    "trequartista": "CAM",
    "right attacking midfield": "RAM",
    "left attacking midfield": "LAM",
    "right attacking midfielder": "RAM",
    "left attacking midfielder": "LAM",
    "number 10": "CAM",
    "no 10": "CAM",

    // Wingers
    "right winger": "RW",
    "left winger": "LW",
    "winger": "RW",
    "right wing": "RW",
    "left wing": "LW",
    "right inside forward": "RW_INSIDE",
    "left inside forward": "LW_INSIDE",
    "inside forward": "RW_INSIDE",
    "right wide forward": "RW",
    "left wide forward": "LW",

    // Forwards
    "striker": "ST",
    "centre forward": "CF",
    "center forward": "CF",
    "forward": "ST",
    "right striker": "RST",
    "left striker": "LST",
    "second striker": "CF_SUPPORT",
    "support striker": "CF_SUPPORT",
    "false nine": "CF_FALSE9",
    "false 9": "CF_FALSE9",
    "target man": "ST",
    "poacher": "ST",
    "advanced forward": "ST",
    "complete forward": "CF",
  };

  const direct = map[normalized];
  if (direct) return direct;

  // Fallback: check if it's already a detail code
  const upper = label.trim().toUpperCase();
  if (upper in POSITION_DETAILS) return upper as PosDetail;

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Pitch coordinates — precise placement for each of the 28 positions
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Pitch anchor for detail positions. Same coordinate system as formations.ts:
 *   x = own-goal → opponent-goal (0 → 1)
 *   y = pitch width (0 = right, 1 = left when attacking right)
 */
export type PitchAnchor = { x: number; y: number };

export const DETAIL_ANCHORS: Record<PosDetail, PitchAnchor> = {
  // Goalkeeper
  GK:              { x: 0.05, y: 0.50 },

  // Full-backs
  RB:              { x: 0.22, y: 0.12 },
  LB:              { x: 0.22, y: 0.88 },

  // Wing-backs (slightly higher than full-backs)
  RWB:             { x: 0.32, y: 0.10 },
  LWB:             { x: 0.32, y: 0.90 },

  // Centre-backs
  RCB:             { x: 0.18, y: 0.35 },
  LCB:             { x: 0.18, y: 0.65 },
  CB:              { x: 0.16, y: 0.50 },
  SW:              { x: 0.10, y: 0.50 },

  // Defensive midfielders
  CDM:             { x: 0.32, y: 0.50 },
  CDM_DEEP:        { x: 0.28, y: 0.50 },

  // Central midfielders
  CM:              { x: 0.45, y: 0.50 },
  RCM:             { x: 0.45, y: 0.32 },
  LCM:             { x: 0.45, y: 0.68 },
  CM_RIGHT:        { x: 0.48, y: 0.38 },
  CM_LEFT:         { x: 0.48, y: 0.62 },

  // Attacking midfielders
  CAM:             { x: 0.58, y: 0.50 },
  RAM:             { x: 0.60, y: 0.30 },
  LAM:             { x: 0.60, y: 0.70 },
  CAM_RIGHT:       { x: 0.62, y: 0.38 },
  CAM_LEFT:        { x: 0.62, y: 0.62 },

  // Wingers
  RW:              { x: 0.72, y: 0.12 },
  LW:              { x: 0.72, y: 0.88 },
  RW_INSIDE:       { x: 0.70, y: 0.28 },
  LW_INSIDE:       { x: 0.70, y: 0.72 },
  RM:              { x: 0.55, y: 0.18 },
  LM:              { x: 0.55, y: 0.82 },

  // Forwards
  ST:              { x: 0.82, y: 0.50 },
  RST:             { x: 0.80, y: 0.38 },
  LST:             { x: 0.80, y: 0.62 },
  CF:              { x: 0.72, y: 0.50 },
  CF_FALSE9:       { x: 0.58, y: 0.50 },
  CF_SUPPORT:      { x: 0.75, y: 0.45 },
};
