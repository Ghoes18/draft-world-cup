/**
 * Overlay curated or external ratings onto an existing SquadCatalog.
 *
 * Precedence when chaining CLIs: heuristic base < external CSV < curated JSON.
 */

import {
  normalizeCatalog,
  type PlayerCard,
  type RawCatalogExport,
  type SquadCatalog,
} from "../catalog.js";
import { matchLivePlayerToCatalogId } from "./liveImport.js";

function normalizePlayerName(name: string): string {
  return name
    .replace(/^not applicable\s+/i, "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/** Match overlay row to catalog player id within a scenario. */
export function matchOverlayPlayerToCatalogId(
  catalog: SquadCatalog,
  scenarioId: string,
  overlay: {
    name: string;
    shirtNumber?: number;
    id?: string;
  },
): string | null {
  const scenario = catalog.scenarios.find((s) => s.id === scenarioId);
  if (!scenario) return null;

  if (overlay.id) {
    const byId = scenario.playerIds.find((pid) => pid === overlay.id);
    if (byId) return byId;
    const suffix = overlay.id.includes("__")
      ? overlay.id.split("__").pop()
      : overlay.id;
    if (suffix) {
      for (const playerId of scenario.playerIds) {
        if (playerId.endsWith(`__${suffix}`) || playerId === suffix) {
          return playerId;
        }
      }
    }
  }

  return matchLivePlayerToCatalogId(catalog, scenarioId, {
    name: overlay.name,
    ...(overlay.shirtNumber !== undefined
      ? { shirtNumber: overlay.shirtNumber }
      : {}),
  });
}

function patchPlayer(
  existing: PlayerCard,
  overlay: RawCatalogExport["scenarios"][number]["players"][number],
): PlayerCard {
  const overall =
    typeof overlay.overall === "number"
      ? overlay.overall
      : typeof overlay.rating === "number"
        ? overlay.rating
        : existing.overall;

  return {
    ...existing,
    naturalPosition: overlay.naturalPosition,
    overall,
    force: overlay.force ?? existing.force,
    ...(overlay.positions !== undefined && overlay.positions.length > 0
      ? { positions: overlay.positions }
      : {}),
    ...(overlay.positionSource !== undefined
      ? { positionSource: overlay.positionSource }
      : overlay.positions !== undefined && overlay.positions.length > 0
        ? { positionSource: "api" as const }
        : {}),
    ...(overlay.shirtNumber !== undefined
      ? { shirtNumber: overlay.shirtNumber }
      : {}),
    ...(overlay.photoUrl !== undefined ? { photoUrl: overlay.photoUrl } : {}),
    ...(overlay.photoSource !== undefined
      ? { photoSource: overlay.photoSource }
      : overlay.photoUrl !== undefined
        ? { photoSource: "curated" as const }
        : {}),
  };
}

/** Patch one or more raw export overlays onto a catalog (shirt, name, or id match). */
export function overlayRawExportOnCatalog(
  catalog: SquadCatalog,
  overlays: readonly RawCatalogExport[],
): { catalog: SquadCatalog; patched: number; unmatched: number } {
  const players: Record<string, PlayerCard> = { ...catalog.players };
  let patched = 0;
  let unmatched = 0;

  for (const raw of overlays) {
    for (const scenario of raw.scenarios) {
      const hasScenario = catalog.scenarios.some((s) => s.id === scenario.id);
      if (!hasScenario) {
        unmatched += scenario.players.length;
        continue;
      }

      for (const row of scenario.players) {
        const playerId = matchOverlayPlayerToCatalogId(catalog, scenario.id, {
          name: row.name,
          ...(row.shirtNumber !== undefined
            ? { shirtNumber: row.shirtNumber }
            : {}),
          id: row.id,
        });
        if (!playerId) {
          unmatched++;
          continue;
        }

        const existing = players[playerId];
        if (!existing) {
          unmatched++;
          continue;
        }

        players[playerId] = patchPlayer(existing, row);
        patched++;
      }
    }
  }

  return { catalog: { scenarios: catalog.scenarios, players }, patched, unmatched };
}

/** Merge multiple autoral exports into one (for batch curated files). */
export function mergeRawCatalogExports(
  exports: readonly RawCatalogExport[],
): RawCatalogExport {
  const scenarioMap = new Map<string, RawCatalogExport["scenarios"][number]>();

  for (const raw of exports) {
    for (const scenario of raw.scenarios) {
      const existing = scenarioMap.get(scenario.id);
      if (!existing) {
        scenarioMap.set(scenario.id, {
          id: scenario.id,
          team: scenario.team,
          cup: scenario.cup,
          players: [...scenario.players],
        });
        continue;
      }
      const byShirt = new Map(
        existing.players
          .filter((p) => p.shirtNumber !== undefined)
          .map((p) => [p.shirtNumber!, p]),
      );
      const byName = new Map(
        existing.players.map((p) => [normalizePlayerName(p.name), p]),
      );
      for (const p of scenario.players) {
        const shirtKey = p.shirtNumber;
        const nameKey = normalizePlayerName(p.name);
        if (shirtKey !== undefined && byShirt.has(shirtKey)) {
          const idx = existing.players.indexOf(byShirt.get(shirtKey)!);
          existing.players[idx] = p;
        } else if (byName.has(nameKey)) {
          const idx = existing.players.indexOf(byName.get(nameKey)!);
          existing.players[idx] = p;
        } else {
          existing.players.push(p);
        }
      }
    }
  }

  return {
    scenarios: [...scenarioMap.values()].sort(
      (a, b) => a.cup - b.cup || a.team.localeCompare(b.team),
    ),
  };
}

/** Apply overlay and return normalized catalog. */
export function applyCatalogOverlay(
  base: SquadCatalog,
  overlays: readonly RawCatalogExport[],
): { catalog: SquadCatalog; patched: number; unmatched: number } {
  return overlayRawExportOnCatalog(base, overlays);
}

/** Build catalog from raw overlay only (no base). */
export function catalogFromRawExport(raw: RawCatalogExport): SquadCatalog {
  return normalizeCatalog(raw);
}
