/**
 * Playable positions per player — API-authoritative placement rules.
 *
 * - `positionSource: "api"` — only listed positions (same-role formation labels).
 * - `positionSource: "inferred"` — Fjelstul GK/DF/MF/FW expansion (FW = striker line only).
 * - No list — natural position with adjacent-role flexibility (legacy demo).
 */

import type { PlayerCard } from "./catalog.js";
import type { PositionSource } from "./catalog/livePlayerParse.js";
import {
  isBroadDetailDefenderList,
  isBroadDetailForwardList,
  isBroadDetailMidfieldList,
  isBroadDetailPositionList,
  isDetailCode,
  normalizeFormationSlotToDetail,
} from "./catalog/detailPositionsMigrate.js";
import {
  positionFit,
  canonicalRole,
  ROLE_ADJACENCY,
  type Role,
} from "./chemistry.js";
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

  const apiNorm = normalizeFormationSlotToDetail(api);
  const slotNorm = normalizeFormationSlotToDetail(slot);
  const apiDetail = POSITION_DETAILS[apiNorm as PosDetail];
  const slotDetail = POSITION_DETAILS[slotNorm as PosDetail];

  if (apiDetail && slotDetail) {
    if (apiDetail.role === "FB" && slotDetail.role === "FB") {
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "FB" || slotDetail.role === "FB") return false;
    if (apiDetail.role === "CB" && slotDetail.role === "CB") {
      if (apiDetail.side === "C" || slotDetail.side === "C") return true;
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "ST" && slotDetail.role === "ST") {
      if (apiDetail.side === "C" || slotDetail.side === "C") return true;
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "W" && slotDetail.role === "W") {
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "AM" && slotDetail.role === "AM") {
      if (apiDetail.side === "C" || slotDetail.side === "C") return true;
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "CM" && slotDetail.role === "CM") {
      if (apiDetail.side === "C" || slotDetail.side === "C") return true;
      return apiDetail.side === slotDetail.side;
    }
    if (apiDetail.role === "DM" && slotDetail.role === "DM") {
      if (apiDetail.side === "C" || slotDetail.side === "C") return true;
      return apiDetail.side === slotDetail.side;
    }
    return apiDetail.role === slotDetail.role;
  }

  const apiRole = canonicalRole(api);
  const slotRole = canonicalRole(slot);
  if (apiRole === null || slotRole === null || apiRole !== slotRole) return false;

  const apiSide = api.match(/^(R|L)(?=[A-Z])/)?.[1];
  const slotSide = slot.match(/^(R|L)(?=[A-Z])/)?.[1];
  if (apiSide && slotSide && apiSide !== slotSide) return false;
  return true;
}

function detailMeta(code: string) {
  const normalized = normalizeFormationSlotToDetail(code);
  if (!isDetailCode(normalized)) return null;
  return POSITION_DETAILS[normalized];
}

function matchesSameSideFullBack(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  return natural.role === "FB" && slot.role === "FB" && natural.side === slot.side;
}

function matchesSameSideCenterBack(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role !== "CB" || slot.role !== "CB") return false;
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function matchesSameSideWide(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  return natural.role === "W" && slot.role === "W" && natural.side === slot.side;
}

function matchesSameSideAttackingMid(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role !== "AM" || slot.role !== "AM") return false;
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function matchesSameSideCentralMid(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role !== "CM" || slot.role !== "CM") return false;
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function matchesSameSideStriker(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role !== "ST" || slot.role !== "ST") return false;
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function matchesSameSideDefensiveMid(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role !== "DM" || slot.role !== "DM") return false;
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function sidesCompatibleForBroadPlacement(
  natural: (typeof POSITION_DETAILS)[PosDetail],
  slot: (typeof POSITION_DETAILS)[PosDetail],
): boolean {
  if (natural.role === "FB") return matchesSameSideFullBack(natural, slot);
  if (natural.role === "CB") return matchesSameSideCenterBack(natural, slot);
  if (natural.side === "C" || slot.side === "C") return true;
  return natural.side === slot.side;
}

function slotListedInBroadBlob(
  slotCode: PosDetail,
  broadPositions: readonly string[],
): boolean {
  return broadPositions.some((listed) => {
    const normalized = normalizeFormationSlotToDetail(listed);
    return normalized === slotCode;
  });
}

/** Broad migrated blobs: strict for defenders, role-adjacent for mid/fwd autofill. */
function matchesBroadDetailPlaceholder(
  naturalPosition: string,
  slotPosition: string,
  broadPositions: readonly string[],
): boolean {
  const natural = detailMeta(naturalPosition);
  const slot = detailMeta(slotPosition);
  if (!natural || !slot) {
    return positionFit(naturalPosition, slotPosition) >= FIT_ADJACENT;
  }

  if (natural.role === "FB") return matchesSameSideFullBack(natural, slot);

  // FB naturals are fully resolved above, so the only cross-role defender case
  // left is a centre-back asked to cover a full-back slot — never an autofill.
  if (natural.role === "CB" && slot.role === "FB") {
    return false;
  }

  if (natural.role === "CM" && slot.role === "W" && slot.family === "MID") {
    return natural.side === "C" || slot.side === natural.side;
  }

  if (natural.role === "W" && slot.role === "W") {
    return matchesSameSideWide(natural, slot);
  }

  if (natural.role === "AM" && slot.role === "AM") {
    return matchesSameSideAttackingMid(natural, slot);
  }

  if (natural.role === "ST" && slot.role === "ST") {
    return matchesSameSideStriker(natural, slot);
  }

  if (natural.role === "DM" && slot.role === "DM") {
    return matchesSameSideDefensiveMid(natural, slot);
  }

  if (natural.role === "CM" && slot.role === "CM") {
    return matchesSameSideCentralMid(natural, slot);
  }

  if (natural.role === slot.role) {
    return sidesCompatibleForBroadPlacement(natural, slot);
  }

  if (isBroadDetailDefenderList(broadPositions)) return false;

  if (!ROLE_ADJACENCY[natural.role]?.has(slot.role)) return false;

  if (isBroadDetailForwardList(broadPositions)) {
    const stWingFlex =
      (natural.role === "ST" && slot.role === "W") ||
      (natural.role === "W" && slot.role === "ST");
    if (stWingFlex) {
      return (
        natural.side === "C" ||
        slot.side === "C" ||
        natural.side === slot.side
      );
    }
  }

  if (isBroadDetailMidfieldList(broadPositions)) {
    if (slotListedInBroadBlob(slot.code, broadPositions)) {
      return sidesCompatibleForBroadPlacement(natural, slot);
    }
  }

  return (
    natural.side === "C" ||
    slot.side === "C" ||
    natural.side === slot.side
  );
}

/** Side-specific striker naturals may cover the same-side winger slot. */
function matchesSideStrikerToWing(
  naturalPosition: string,
  slotPosition: string,
): boolean {
  const natural = detailMeta(naturalPosition);
  const slot = detailMeta(slotPosition);
  if (!natural || !slot) return false;
  if (natural.role !== "ST" || slot.role !== "W") return false;
  if (natural.side === "C") return false;
  return natural.side === slot.side;
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
    if (isBroadDetailPositionList(player.positions)) {
      return matchesBroadDetailPlaceholder(
        player.naturalPosition,
        slotPosition,
        player.positions,
      );
    }
    return (
      player.positions.some((p) => matchesApiPosition(p, slotPosition)) ||
      matchesSideStrikerToWing(player.naturalPosition, slotPosition)
    );
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

/** Short label for a formation slot code (detail-aware). */
function slotShortLabel(code: string): string {
  const normalized = normalizeFormationSlotToDetail(code);
  const detail = POSITION_DETAILS[normalized as PosDetail];
  return detail ? detail.shortLabel : code.trim().toUpperCase();
}

/** Formation slots this player may occupy in the current XI (open or filled). */
export function formatEligibleFormationSlots(
  player: PlayerCard,
  formationSlots: readonly { position: string }[],
): string {
  const seen = new Set<string>();
  const labels: string[] = [];
  for (const slot of formationSlots) {
    if (!canPlayInSlot(player, slot.position)) continue;
    const code = slot.position.trim().toUpperCase();
    if (seen.has(code)) continue;
    seen.add(code);
    labels.push(slotShortLabel(code));
  }
  if (labels.length > 0) return labels.join(" · ");
  return formatPlayerPositions(player);
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
  return unique.map((code) => slotShortLabel(code)).join(" · ");
}
