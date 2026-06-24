/**
 * CLI: Migrate curated squad JSONs from coarse positions to detail positions.
 *
 * Strategy:
 *   1. Read each curated JSON
 *   2. For each player, expand coarse naturalPosition + positions[] into detail
 *   3. Use Transfermarkt data if available for better precision
 *   4. Otherwise use heuristic rules (e.g., in a 4-4-2, the two STs → RST + LST)
 *   5. Write back with detail-level positions
 *
 * Usage: npx tsx src/cli/migrate-positions.ts [squad-dir]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expandCoarseToDetail, type PosDetail } from "../positionsDetail.js";

const SQUAD_DIR = process.argv[2] ?? "squads/curated";

// ─── Heuristic formation-aware placement ────────────────────────────────────

interface SquadFormation {
  slots: { position: string; index: number }[];
}

/**
 * Common formations with their slot positions.
 * Used to disambiguate which player plays where when we only have coarse labels.
 */
const COMMON_FORMATIONS: Record<string, string[]> = {
  "4-4-2":     ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "RST", "LST"],
  "4-3-3":     ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RW", "ST", "LW"],
  "4-2-3-1":   ["GK", "RB", "RCB", "LCB", "LB", "RCDM", "LCDM", "RAM", "CAM", "LAM", "ST"],
  "4-3-1-2":   ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "CAM", "RST", "LST"],
  "3-5-2":     ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "CM", "LCM", "LWB", "RST", "LST"],
  "5-3-2":     ["GK", "RCB", "CB", "LCB", "RWB", "RCM", "LCM", "LWB", "RST", "LST"],
  "4-5-1":     ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "CM", "LCM", "LM", "ST"],
  "4-1-4-1":   ["GK", "RB", "RCB", "LCB", "LB", "CDM", "RM", "RCM", "LCM", "LM", "ST"],
  "3-4-3":     ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "RW", "ST", "LW"],
  "4-3-2-1":   ["GK", "RB", "RCB", "LCB", "LB", "RCM", "CM", "LCM", "RAM", "LAM", "ST"],
  "4-4-1-1":   ["GK", "RB", "RCB", "LCB", "LB", "RM", "RCM", "LCM", "LM", "CAM", "ST"],
  "3-4-1-2":   ["GK", "RCB", "CB", "LCB", "RM", "RCM", "LCM", "LM", "CAM", "RST", "LST"],
  "5-4-1":     ["GK", "RCB", "CB", "LCB", "RWB", "LWB", "RCM", "LCM", "CAM", "ST"],
  "4-2-4":     ["GK", "RB", "RCB", "LCB", "LB", "RCM", "LCM", "RW", "RST", "LST", "LW"],
};

/**
 * Given a coarse position and the formation context, pick the most likely
 * detail position for a player. Uses the player's index in the squad list
 * (which typically follows the formation order: GK, DEF, MID, FWD).
 */
function assignDetailFromFormation(
  coarse: string,
  playerIndex: number,
  totalPlayers: number,
  formation: string,
): PosDetail {
  const slots = COMMON_FORMATIONS[formation] ?? COMMON_FORMATIONS["4-4-2"]!;

  // The slot at this index tells us the precise position
  const slot = slots[playerIndex] ?? slots[Math.min(playerIndex, slots.length - 1)]!;

  // Map slot to detail
  return slot as PosDetail;
}

// ─── Main migration ──────────────────────────────────────────────────────────

function migrateSquad(filePath: string): { changed: number; total: number } {
  const raw = readFileSync(filePath, "utf-8");
  const data = JSON.parse(raw) as {
    scenarios: Array<{
      id: string;
      team: string;
      cup: number;
      players: Array<{
        id?: string;
        name: string;
        naturalPosition: string;
        positions?: string[];
        positionSource?: string;
        overall: number;
        force: number;
        shirtNumber?: number;
        photoUrl?: string;
      }>;
    }>;
  };

  let changed = 0;
  let total = 0;

  for (const scenario of data.scenarios) {
    // Detect formation from squad size and player order
    const formation = detectFormation(scenario.players);

    scenario.players.forEach((player, idx) => {
      total++;
      const oldNatural = player.naturalPosition;
      const oldPositions = player.positions ?? [oldNatural];

      // Assign detail positions based on formation context
      const naturalDetail = assignDetailFromFormation(oldNatural, idx, scenario.players.length, formation);

      // Expand all listed positions to detail variants
      const detailPositions: PosDetail[] = [];
      for (const pos of oldPositions) {
        const details = expandCoarseToDetail(pos);
        detailPositions.push(...details);
      }
      // Deduplicate
      const uniqueDetail = [...new Set(detailPositions)] as PosDetail[];

      // Update player
      player.naturalPosition = naturalDetail;
      player.positions = uniqueDetail;

      if (oldNatural !== naturalDetail || JSON.stringify(oldPositions) !== JSON.stringify(uniqueDetail)) {
        changed++;
      }
    });
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { changed, total };
}

/** Detect the most likely formation from player count and positions. */
function detectFormation(players: Array<{ naturalPosition: string }>): string {
  const count = players.length;
  if (count < 10) return "4-4-2"; // minimum playable

  // Count defenders, midfielders, forwards
  const gk = players.filter((p) => p.naturalPosition === "GK").length;
  const def = players.filter((p) =>
    ["RB", "LB", "RCB", "LCB", "CB", "RWB", "LWB", "SW"].includes(p.naturalPosition)
  ).length;
  const mid = players.filter((p) =>
    ["CDM", "CM", "RCM", "LCM", "CAM", "RAM", "LAM", "RM", "LM", "AM", "DM", "MF"].includes(p.naturalPosition)
  ).length;
  const fwd = count - gk - def - mid;

  // Match to common formation
  if (def === 3 && mid === 5 && fwd === 2) return "3-5-2";
  if (def === 5 && mid === 3 && fwd === 2) return "5-3-2";
  if (def === 5 && mid === 4 && fwd === 1) return "5-4-1";
  if (def === 4 && mid === 5 && fwd === 1) return "4-5-1";
  if (def === 4 && mid === 4 && fwd === 2) return "4-4-2";
  if (def === 4 && mid === 3 && fwd === 3) return "4-3-3";
  if (def === 4 && mid === 2 && fwd === 4) return "4-2-4";
  if (def === 3 && mid === 4 && fwd === 3) return "3-4-3";
  if (def === 4 && mid === 6 && fwd === 1) return "4-1-4-1";
  if (def === 4 && mid === 1 && mid + fwd === 6) return "4-1-4-1";

  // Default based on defender count
  if (def === 3) return "3-5-2";
  if (def === 5) return "5-3-2";
  return "4-4-2";
}

// ─── CLI ─────────────────────────────────────────────────────────────────────

function main() {
  const dir = SQUAD_DIR;
  const files = readdirSync(dir).filter((f) => f.endsWith(".json"));

  console.log(`Migrating ${files.length} squad files from ${dir}...\n`);

  let totalChanged = 0;
  let totalPlayers = 0;

  for (const file of files) {
    const filePath = join(dir, file);
    const { changed, total } = migrateSquad(filePath);
    totalChanged += changed;
    totalPlayers += total;
    console.log(`  ${file}: ${changed}/${total} players updated`);
  }

  console.log(`\nDone! ${totalChanged}/${totalPlayers} players updated.`);
}

main();
