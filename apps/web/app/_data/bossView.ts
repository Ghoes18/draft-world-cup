import {
  bossForWeek,
  playerOverall,
  resolveBossBuildState,
  type BuildState,
  type SquadCatalog,
} from "7a0-engine";
import type { BossLineupPlayer, BossView } from "../_components/BossCard";

function bossSquadForWeek(
  catalog: SquadCatalog,
  weekKey: string,
): { lineup: BossLineupPlayer[]; buildState: BuildState } {
  const definition = bossForWeek(weekKey);
  const buildState = resolveBossBuildState(catalog, definition, weekKey, "away");
  const lineup = buildState.slots.flatMap((slot) => {
    const id = slot.selectedPlayerId;
    if (!id) return [];
    const player = catalog.players[id];
    if (!player) return [];
    return [
      {
        id,
        name: player.name,
        overall: playerOverall(player),
        position: slot.position,
      },
    ];
  });
  return { lineup, buildState };
}

/** Thematic Boss metadata for a week — derived locally from the engine (same seed as Convex). */
export function bossViewForWeekKey(weekKey: string, catalog?: SquadCatalog): BossView {
  const def = bossForWeek(weekKey);
  const squad = catalog ? bossSquadForWeek(catalog, weekKey) : null;
  return {
    weekKey,
    id: def.id,
    name: def.name,
    subtitle: def.subtitle,
    difficulty: def.difficulty,
    featuredPlayers: [...def.featuredPlayers],
    tactic: def.tactic,
    lineup: squad?.lineup ?? [],
    buildState: squad?.buildState ?? null,
  };
}

/**
 * Resolve the active Boss for UI. Only `weekKey` from Convex is required;
 * name, subtitle, difficulty, featured players and tactic come from the engine.
 */
export function normalizeBossView(raw: unknown, catalog?: SquadCatalog): BossView | null {
  if (!raw || typeof raw !== "object") return null;
  const weekKey = (raw as Record<string, unknown>).weekKey;
  if (typeof weekKey !== "string") return null;

  try {
    return bossViewForWeekKey(weekKey, catalog);
  } catch {
    return null;
  }
}
