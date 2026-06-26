/**
 * Squad synergy — chemistry from shared nationality / shared World Cup squad,
 * plus a legend bonus. The chemistry half of MVP M2 (tactics already exist via
 * `effectiveStrength`).
 *
 * Two synergy tiers between any pair of fielded players:
 *   - countrymen  — same national `team`           → LINK_COUNTRYMAN
 *   - teammates   — same `team` AND same `cup`      → LINK_TEAMMATE (they really played together)
 *
 * Pairwise link score maps to a chemistry% (neutral 50 floor → no penalty,
 * saturates to 100%), then to the CLAUDE.md chemistryBonus (0…+3) applied to
 * attack/midfield/defense. Legends add to overall, capped.
 *
 * Pure and deterministic, so it runs server-side in front of `effectiveStrength`
 * for online + daily.
 */

import { getPlayer, type SquadCatalog } from "./catalog.js";
import {
  CHEM_BONUS_RANGE,
  CHEM_SATURATION,
  LEGEND_OVERALL_CAP,
  LEGEND_OVERALL_PER,
  LINK_COUNTRYMAN,
  LINK_TEAMMATE,
} from "./constants.js";
import { isLegendPlayer } from "./legends.js";
import type { BuildState } from "./roll.js";
import type { LineupSlot } from "./types.js";

export interface Synergy {
  /** 50 (no links) … 100 (saturated). */
  chemistryPercent: number;
  /** round((chem% − 50) / 100 × 6) → 0…+3, applied to attack/midfield/defense. */
  chemistryBonus: number;
  /** Legends fielded in the XI. */
  legendCount: number;
  /** min(legendCount × LEGEND_OVERALL_PER, LEGEND_OVERALL_CAP), applied to overall. */
  legendBonus: number;
}

interface SynergyPlayer {
  team: string;
  cup: number;
  name: string;
}

const NEUTRAL: Synergy = {
  chemistryPercent: 50,
  chemistryBonus: 0,
  legendCount: 0,
  legendBonus: 0,
};

/** Derive synergy from a concrete list of fielded players. */
function synergyFromPlayers(players: SynergyPlayer[]): Synergy {
  if (players.length === 0) return NEUTRAL;

  let linkScore = 0;
  for (let i = 0; i < players.length; i++) {
    for (let j = i + 1; j < players.length; j++) {
      const a = players[i]!;
      const b = players[j]!;
      if (a.team !== b.team) continue;
      linkScore += a.cup === b.cup ? LINK_TEAMMATE : LINK_COUNTRYMAN;
    }
  }

  const saturation = Math.min(linkScore / CHEM_SATURATION, 1);
  const chemistryPercent = 50 + saturation * 50;
  const chemistryBonus = Math.round(
    ((chemistryPercent - 50) / 100) * CHEM_BONUS_RANGE,
  );

  const legendCount = players.filter((p) => isLegendPlayer(p.name)).length;
  const legendBonus = Math.min(
    legendCount * LEGEND_OVERALL_PER,
    LEGEND_OVERALL_CAP,
  );

  return { chemistryPercent, chemistryBonus, legendCount, legendBonus };
}

/** Synergy for a complete (or partial) lineup. */
export function lineupSynergy(
  catalog: SquadCatalog,
  lineup: LineupSlot[],
): Synergy {
  return synergyFromPlayers(
    lineup.map((slot) => {
      const p = getPlayer(catalog, slot.playerId);
      return { team: p.team, cup: p.cup, name: p.name };
    }),
  );
}

/** Synergy for an in-progress or complete Build state (filled slots only). */
export function buildStateSynergy(
  catalog: SquadCatalog,
  state: BuildState,
): Synergy {
  const players: SynergyPlayer[] = [];
  for (const slot of state.slots) {
    if (!slot.selectedPlayerId) continue;
    const p = getPlayer(catalog, slot.selectedPlayerId);
    players.push({ team: p.team, cup: p.cup, name: p.name });
  }
  return synergyFromPlayers(players);
}
