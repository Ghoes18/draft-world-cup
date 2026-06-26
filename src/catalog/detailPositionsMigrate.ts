/**
 * Migrate catalog / squad players from ambiguous central detail codes (CB, CM, ST)
 * to side-aware 28-position labels, with squad-context disambiguation.
 */

import type { Role } from "../chemistry.js";
import { canonicalRole } from "../chemistry.js";
import type { PlayerCard, SquadCatalog } from "../catalog.js";
import {
  detailToRole,
  expandCoarseToDetail,
  POSITION_DETAILS,
  type PosDetail,
} from "../positionsDetail.js";

/** Central detail codes that need side disambiguation within a squad. */
const AMBIGUOUS_NATURALS = new Set<PosDetail>([
  "CB",
  "CM",
  "ST",
  "CF",
  "CAM",
  "CDM",
  "CDM_DEEP",
  "SW",
  "CF_FALSE9",
  "CF_SUPPORT",
]);

/** Rotation order when assigning naturals per role inside one squad. */
const SQUAD_SIDE_ROTATION: Record<Role, readonly PosDetail[]> = {
  GK: ["GK"],
  FB: ["RB", "LB", "RWB", "LWB"],
  CB: ["RCB", "LCB", "CB"],
  DM: ["CDM", "CDM_DEEP"],
  CM: ["RCM", "LCM", "CM", "CM_RIGHT", "CM_LEFT"],
  AM: ["RAM", "LAM", "CAM", "CAM_RIGHT", "CAM_LEFT"],
  W: ["RW", "LW", "RW_INSIDE", "LW_INSIDE", "RM", "LM"],
  ST: ["RST", "LST", "ST", "CF", "CF_SUPPORT", "CF_FALSE9"],
};

const BROAD_DETAIL_POSITION_SETS: readonly (readonly PosDetail[])[] = [
  ["RCB", "LCB", "CB", "LB", "LWB", "RB", "RWB"],
  [
    "CM",
    "RCM",
    "LCM",
    "CM_LEFT",
    "CM_RIGHT",
    "CDM",
    "CDM_DEEP",
    "CAM",
    "RAM",
    "LAM",
    "CAM_RIGHT",
    "CAM_LEFT",
  ],
  ["ST", "RST", "LST", "CF", "CF_FALSE9", "CF_SUPPORT"],
];

const BROAD_DEFENDER_NATURAL_ROTATION: readonly PosDetail[] = [
  "RB",
  "LB",
  "RCB",
  "LCB",
  "CB",
];

/** Formation slot labels that are not detail codes but appear in catalog data. */
const FORMATION_SLOT_TO_DETAIL: Record<string, PosDetail> = {
  LCDM: "CDM",
  RCDM: "CDM",
  AM: "CAM",
  DM: "CDM",
  MEI: "CAM",
  VOL: "CDM",
  CA: "CF",
  FW: "ST",
  PE: "LW",
  PD: "RW",
  WF: "RW",
};

/** Map formation slot labels (RCDM, PD, …) to detail codes. */
export function normalizeFormationSlotToDetail(code: string): string {
  const upper = code.trim().toUpperCase();
  return FORMATION_SLOT_TO_DETAIL[upper] ?? upper;
}

function normalizePositionCode(code: string): string {
  return normalizeFormationSlotToDetail(code);
}

export function isDetailCode(code: string): code is PosDetail {
  return code.trim().toUpperCase() in POSITION_DETAILS;
}

export function isSideSpecificDetail(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (!isDetailCode(upper)) return false;
  return POSITION_DETAILS[upper].side !== "C";
}

export function isAmbiguousDetailNatural(code: string): boolean {
  const upper = code.trim().toUpperCase();
  if (!isDetailCode(upper)) return true;
  if (upper === "GK") return false;
  return AMBIGUOUS_NATURALS.has(upper);
}

function sortedPositionKey(positions: readonly string[]): string {
  return [...new Set(positions.map((p) => p.trim().toUpperCase()))]
    .sort()
    .join(",");
}

export function isBroadDetailPositionList(
  positions: readonly string[] | undefined,
): boolean {
  if (!positions?.length) return false;
  const key = sortedPositionKey(positions);
  return BROAD_DETAIL_POSITION_SETS.some(
    (template) => sortedPositionKey(template) === key,
  );
}

export function isBroadDetailDefenderList(
  positions: readonly string[] | undefined,
): boolean {
  if (!positions?.length) return false;
  return (
    sortedPositionKey(positions) === sortedPositionKey(BROAD_DETAIL_POSITION_SETS[0]!)
  );
}

export function isBroadDetailMidfieldList(
  positions: readonly string[] | undefined,
): boolean {
  if (!positions?.length) return false;
  return (
    sortedPositionKey(positions) === sortedPositionKey(BROAD_DETAIL_POSITION_SETS[1]!)
  );
}

export function isBroadDetailForwardList(
  positions: readonly string[] | undefined,
): boolean {
  if (!positions?.length) return false;
  return (
    sortedPositionKey(positions) === sortedPositionKey(BROAD_DETAIL_POSITION_SETS[2]!)
  );
}

/** Map a coarse or detail code to a single detail natural (side hint from R/L prefix). */
export function toNaturalDetail(position: string): PosDetail {
  const upper = normalizePositionCode(position);
  if (isDetailCode(upper)) return upper;

  const side = upper.match(/^(R|L)(?=[A-Z])/)?.[1] as "R" | "L" | undefined;
  const expanded = expandCoarseToDetail(upper).filter(isDetailCode);

  if (side) {
    const sideMatch = expanded.find(
      (code) => POSITION_DETAILS[code].side === side,
    );
    if (sideMatch) return sideMatch;
  }

  return expanded[0]!;
}

/** Expand playable position codes to the full detail set (deduped, stable order). */
export function expandPositionsToDetail(
  positions: readonly string[],
): PosDetail[] {
  const expanded: PosDetail[] = [];
  for (const pos of positions) {
    const normalized = normalizePositionCode(pos);
    if (isDetailCode(normalized)) {
      expanded.push(normalized);
      continue;
    }
    for (const code of expandCoarseToDetail(normalized)) {
      if (isDetailCode(code)) expanded.push(code);
    }
  }
  return [...new Set(expanded)];
}

function roleOf(code: string): Role | null {
  const upper = code.trim().toUpperCase();
  if (isDetailCode(upper)) return detailToRole(upper);
  return canonicalRole(upper);
}

function pickSideFromPositions(
  naturalRole: Role,
  positions: readonly PosDetail[],
): PosDetail | null {
  const roleMatch = positions.filter((code) => {
    if (!isDetailCode(code)) return false;
    const meta = POSITION_DETAILS[code];
    return meta.role === naturalRole && meta.side !== "C";
  });
  if (roleMatch.length === 1) return roleMatch[0]!;

  const anySide = positions.filter(
    (code) => isDetailCode(code) && POSITION_DETAILS[code].side !== "C",
  );
  if (anySide.length === 1) return anySide[0]!;

  return null;
}

function squadSortKey(
  player: { shirtNumber?: number },
  index: number,
): number {
  if (
    typeof player.shirtNumber === "number" &&
    Number.isFinite(player.shirtNumber) &&
    player.shirtNumber > 0
  ) {
    return player.shirtNumber;
  }
  return 1000 + index;
}

export interface DetailMigratePlayerInput {
  naturalPosition: string;
  positions?: readonly string[];
  shirtNumber?: number;
}

export interface DetailMigratePlayerResult {
  naturalPosition: PosDetail;
  positions: PosDetail[];
}

/**
 * Assign side-aware detail naturals for players in one squad.
 * Preserves existing side-specific naturals; expands all positions[] to detail.
 */
export function assignSquadDetailPositions<
  T extends DetailMigratePlayerInput,
>(players: readonly T[]): Array<T & DetailMigratePlayerResult> {
  const ordered = players
    .map((player, index) => ({ player, index }))
    .sort(
      (a, b) =>
        squadSortKey(a.player, a.index) - squadSortKey(b.player, b.index),
    );

  const roleCounters = new Map<Role, number>();
  let broadDefenderCounter = 0;
  const byIndex = new Map<number, DetailMigratePlayerResult>();

  for (const { player, index } of ordered) {
    const listed = player.positions?.length
      ? player.positions
      : [player.naturalPosition];
    const detailPositions = expandPositionsToDetail(listed);
    const hasBroadDefenderPositions = isBroadDetailDefenderList(detailPositions);
    const broadDefenderSlot = hasBroadDefenderPositions
      ? broadDefenderCounter++
      : undefined;

    const currentNatural = toNaturalDetail(player.naturalPosition);
    let naturalPosition = currentNatural;
    const shouldReassignBroadDefender =
      hasBroadDefenderPositions &&
      detailToRole(currentNatural) === "CB" &&
      currentNatural !== "CB";

    if (
      !shouldReassignBroadDefender &&
      !isAmbiguousDetailNatural(currentNatural)
    ) {
      byIndex.set(index, { naturalPosition, positions: detailPositions });
      continue;
    }

    const naturalRole = roleOf(currentNatural);
    if (naturalRole) {
      const fromListed = pickSideFromPositions(naturalRole, detailPositions);
      if (fromListed) {
        naturalPosition = fromListed;
      } else {
        const rotation = hasBroadDefenderPositions
          ? BROAD_DEFENDER_NATURAL_ROTATION
          : SQUAD_SIDE_ROTATION[naturalRole];
        const slot = broadDefenderSlot ?? roleCounters.get(naturalRole) ?? 0;
        if (broadDefenderSlot === undefined) {
          roleCounters.set(naturalRole, slot + 1);
        }
        naturalPosition = rotation[slot % rotation.length] ?? currentNatural;
      }
    }

    byIndex.set(index, { naturalPosition, positions: detailPositions });
  }

  return players.map((player, index) => {
    const migrated = byIndex.get(index)!;
    return {
      ...player,
      ...migrated,
    };
  });
}

export interface DetailMigrateStats {
  players: number;
  naturalChanged: number;
  positionsExpanded: number;
}

/** Migrate every player in a catalog to side-aware detail positions. */
export function migrateCatalogToDetailPositions(
  catalog: SquadCatalog,
): { catalog: SquadCatalog; stats: DetailMigrateStats } {
  const players = { ...catalog.players };
  let naturalChanged = 0;
  let positionsExpanded = 0;

  for (const scenario of catalog.scenarios) {
    const squadPlayers = scenario.playerIds.map((id) => players[id]!);
    const migrated = assignSquadDetailPositions(squadPlayers);

    for (let i = 0; i < scenario.playerIds.length; i++) {
      const id = scenario.playerIds[i]!;
      const before = players[id]!;
      const player = migrated[i]!;

      if (before.naturalPosition !== player.naturalPosition) naturalChanged++;
      if (
        JSON.stringify(before.positions ?? []) !==
        JSON.stringify(player.positions)
      ) {
        positionsExpanded++;
      }

      players[id] = {
        ...before,
        naturalPosition: player.naturalPosition,
        positions: player.positions,
      };
    }
  }

  return {
    catalog: { ...catalog, players },
    stats: {
      players: Object.keys(players).length,
      naturalChanged,
      positionsExpanded,
    },
  };
}
