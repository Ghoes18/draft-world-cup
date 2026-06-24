/**
 * Playable positions per player — API-authoritative placement rules.
 *
 * - `positionSource: "api"` — only listed positions (same-role formation labels).
 * - `positionSource: "inferred"` — Fjelstul GK/DF/MF/FW expansion (FW = striker line only).
 * - No list — natural position with adjacent-role flexibility (legacy demo).
 */

import type { PlayerCard } from "./catalog.js";
import type { PositionSource } from "./catalog/livePlayerParse.js";
import { positionFit, canonicalRole, type Role } from "./chemistry.js";
import { FIT_ADJACENT, FIT_EXACT } from "./constants.js";
import {
  detailToRole,
  detailToFamily,
  POSITION_DETAILS,
  type PosDetail,
} from "./positionsDetail.js";

const ROLE_DISPLAY_ORDER: readonly Role[] = [
  "GK",
  "FB",
  "CB",
  "DM",
  "CM",
  "AM",
  "W",
  "ST",
];

/** Formation slot codes grouped by canonical role. */
export const FORMATION_VARIANTS: Record<Role, readonly string[]> = {
  GK: ["GK"],
  FB: ["RB", "LB", "RWB", "LWB"],
  CB: ["CB", "RCB", "LCB"],
  DM: ["CDM", "RCDM", "LCDM", "DM", "VOL"],
  CM: ["CM", "RCM", "LCM", "RM", "LM"],
  AM: ["CAM", "AM", "RAM", "LAM", "MEI"],
  W: ["RW", "LW", "WF", "PD"],
  ST: ["ST", "CF", "RST", "LST", "FW", "PE", "CA"],
};

/**
 * Fjelstul squad rows only use GK/DF/MF/FW. Conservative expansion for draft
 * eligibility — FW is striker-line (PE/CA), not wingers (PD).
 */
const FJELSTUL_COARSE_PLAYABLE: Record<string, readonly string[]> = {
  GK: FORMATION_VARIANTS.GK,
  DF: [...FORMATION_VARIANTS.CB, ...FORMATION_VARIANTS.FB],
  MF: [
    ...FORMATION_VARIANTS.DM,
    ...FORMATION_VARIANTS.CM,
    ...FORMATION_VARIANTS.AM,
  ],
  FW: FORMATION_VARIANTS.ST,
};

/** Raw Fjelstul appearance codes → playable formation slots (inferred only). */
export function positionCodesFromFjelstul(positionCode: string): readonly string[] {
  const code = positionCode.trim().toUpperCase();
  const coarse = FJELSTUL_COARSE_PLAYABLE[code];
  if (coarse) return coarse;
  return expandRoleVariants(code);
}

/** Expand a position code to formation labels in the same canonical role. */
export function expandRoleVariants(position: string): readonly string[] {
  const role = canonicalRole(position);
  if (!role) return [position.trim().toUpperCase()];
  return FORMATION_VARIANTS[role];
}

function expandFjelstulMappedCoarse(mapped: string): readonly string[] {
  const code = mapped.trim().toUpperCase();
  const coarse = FJELSTUL_COARSE_PLAYABLE[code];
  if (coarse) return coarse;
  switch (code) {
    case "CB":
      return [...FORMATION_VARIANTS.CB, ...FORMATION_VARIANTS.FB];
    case "CM":
      return FORMATION_VARIANTS.CM;
    case "ST":
      return FORMATION_VARIANTS.ST;
    default:
      return expandRoleVariants(mapped);
  }
}

function uniqueExpanded(codes: readonly string[]): string[] {
  return [...new Set(codes.map((c) => c.trim().toUpperCase()))];
}

/** Whether a formation slot matches one API-listed position (role + side aware). */
export function matchesApiPosition(listed: string, slotPosition: string): boolean {
  const api = listed.trim().toUpperCase();
  const slot = slotPosition.trim().toUpperCase();
  if (api === slot) return true;

  const apiRole = canonicalRole(api);
  const slotRole = canonicalRole(slot);
  if (apiRole === null || slotRole === null || apiRole !== slotRole) return false;

  const apiSide = api.match(/^(R|L)(?=[A-Z])/)?.[1];
  const slotSide = slot.match(/^(R|L)(?=[A-Z])/)?.[1];
  if (apiSide && slotSide && apiSide !== slotSide) return false;
  return true;
}

function expandListedPositions(
  positions: readonly string[],
  source: PositionSource | undefined,
): string[] {
  if (source === "inferred") {
    return uniqueExpanded(
      positions.flatMap((p) => expandFjelstulMappedCoarse(p)),
    );
  }
  return uniqueExpanded(positions.flatMap((p) => expandRoleVariants(p)));
}

/** Positions this player may be fielded in for the current Cup. */
export function playerPlayablePositions(player: PlayerCard): readonly string[] {
  if (player.positions?.length) {
    return expandListedPositions(player.positions, player.positionSource);
  }
  return uniqueExpanded(expandRoleVariants(player.naturalPosition));
}

/** Whether the player may occupy a formation slot at `slotPosition`. */
export function canPlayInSlot(player: PlayerCard, slotPosition: string): boolean {
  if (player.positions?.length && player.positionSource === "api") {
    return player.positions.some((p) => matchesApiPosition(p, slotPosition));
  }

  const playable = playerPlayablePositions(player);
  const hasExplicitList = Boolean(player.positions && player.positions.length > 0);
  const minFit = hasExplicitList ? FIT_EXACT : FIT_ADJACENT;
  return playable.some((p) => positionFit(p, slotPosition) >= minFit);
}

/** Best fit score for a player in a slot (UI sorting / hints). */
export function slotFitForPlayer(
  player: PlayerCard,
  slotPosition: string,
): number {
  return Math.max(
    ...playerPlayablePositions(player).map((p) => positionFit(p, slotPosition)),
  );
}

/** Human-readable position list for chips and pitch labels (API codes, not expanded). */
export function formatPositionList(positions: readonly string[]): string {
  // Check if we have detail-level positions
  const hasDetail = positions.some(
    (p) => p.trim().toUpperCase() in POSITION_DETAILS,
  );

  if (hasDetail) {
    const roles = new Map<Role, string>();
    for (const p of positions) {
      const upper = p.trim().toUpperCase();
      const detail = POSITION_DETAILS[upper as PosDetail];
      const role = detail ? detail.role : canonicalRole(upper);
      if (!role || roles.has(role)) continue;
      roles.set(role, detail ? detail.shortLabel : upper);
    }
    const ordered = ROLE_DISPLAY_ORDER.filter((r) => roles.has(r)).map(
      (r) => roles.get(r)!,
    );
    if (ordered.length > 0) return ordered.join(" · ");
  }

  // Coarse fallback: group by role
  const roles = new Map<Role, string>();
  for (const p of positions) {
    const role = canonicalRole(p);
    if (role && !roles.has(role)) roles.set(role, p.trim().toUpperCase());
  }
  const ordered = ROLE_DISPLAY_ORDER.filter((r) => roles.has(r)).map(
    (r) => roles.get(r)!,
  );
  if (ordered.length > 0) return ordered.join(" · ");
  return uniqueExpanded(positions).join(" · ");
}

/** Side-aware labels for inferred (Fjelstul) players from expanded playable codes. */
function formatInferredPlayable(playable: readonly string[]): string {
  const codes = new Set(playable.map((p) => p.trim().toUpperCase()));
  const labels: string[] = [];

  const has = (...candidates: string[]) =>
    candidates.some((c) => codes.has(c));

  if (has("GK")) labels.push("GK");
  if (has("LB", "LWB")) labels.push("LB");
  if (has("RB", "RWB")) labels.push("RB");
  if (has("LCB")) labels.push("LCB");
  if (has("RCB")) labels.push("RCB");
  if (!has("LCB", "RCB") && has("CB")) labels.push("CB");
  if (has("LCDM")) labels.push("LCDM");
  if (has("RCDM")) labels.push("RCDM");
  if (!has("LCDM", "RCDM") && has("CDM", "DM", "VOL")) labels.push("CDM");
  if (has("LCM")) labels.push("LCM");
  if (has("RCM")) labels.push("RCM");
  if (!has("LCM", "RCM") && has("CM", "LM", "RM")) labels.push("CM");
  if (has("CAM", "AM", "MEI", "LAM", "RAM")) labels.push("CAM");
  if (has("LW", "WF", "PD")) labels.push("LW");
  if (has("RW", "WF", "PD")) labels.push("RW");
  if (has("ST", "RST", "LST")) labels.push("ST");
  else if (has("CF", "CA", "PE", "FW")) labels.push("CF");

  return labels.length > 0 ? labels.join(" · ") : formatPositionList([...codes]);
}

/** Display labels for a player's playable positions (chip / pitch). */
export function formatPlayerPositions(player: PlayerCard): string {
  if (player.positionSource === "api" && player.positions?.length) {
    return formatPositionList(player.positions);
  }
  if (player.positionSource === "inferred") {
    return formatInferredPlayable(playerPlayablePositions(player));
  }
  const listed = player.positions?.length
    ? player.positions
    : [player.naturalPosition];
  return formatPositionList(listed);
}

/** Labels matching open placement buttons (one per empty compatible slot). */
export function formatPlacementOptions(
  slots: readonly { position: string }[],
): string {
  const unique = [
    ...new Set(slots.map((s) => s.position.trim().toUpperCase())),
  ];
  return unique.join(" · ");
}
