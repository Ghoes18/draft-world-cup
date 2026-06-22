/**
 * Parse live 7a0 / squad API player rows into normalized catalog fields.
 */

import { forceToRating } from "../playerRating.js";

export type PositionSource = "api" | "inferred";

export interface LiveSquadPlayerJson {
  id: string;
  name: string;
  pos: string;
  f: number;
  n?: number;
  /** FIFA-style general overall (0–100). */
  overall?: number;
  rating?: number;
  /** Explicit playable positions from the API. */
  positions?: string[] | string;
  playablePositions?: string[] | string;
}

function normalizePositionCode(code: string): string {
  return code.trim().toUpperCase();
}

/** Split API position lists (array, slash-separated, or single code). */
export function parsePlayablePositions(row: LiveSquadPlayerJson): string[] {
  const raw = row.positions ?? row.playablePositions;
  if (Array.isArray(raw)) {
    const codes = raw.map(normalizePositionCode).filter(Boolean);
    if (codes.length > 0) return [...new Set(codes)];
  }
  if (typeof raw === "string" && raw.trim()) {
    const codes = raw
      .split(/[/,|]/)
      .map(normalizePositionCode)
      .filter(Boolean);
    if (codes.length > 0) return [...new Set(codes)];
  }
  return [normalizePositionCode(row.pos)];
}

export function parsePlayerOverall(
  row: LiveSquadPlayerJson,
  decodedForce: number,
): number {
  const direct = row.overall ?? row.rating;
  if (typeof direct === "number" && Number.isFinite(direct)) {
    return Math.round(Math.min(100, Math.max(0, direct)));
  }
  return forceToRating(decodedForce);
}

export function parsePositionSource(row: LiveSquadPlayerJson): PositionSource {
  const hasExplicitList =
    row.positions !== undefined || row.playablePositions !== undefined;
  return hasExplicitList ? "api" : "api";
}
