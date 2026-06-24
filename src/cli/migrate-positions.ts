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
import {
  expandCoarseToDetail,
  POSITION_DETAILS,
  type PosDetail,
} from "../positionsDetail.js";

const SQUAD_DIR = process.argv[2] ?? "squads/curated";

/** Map a coarse or detail code to a single canonical detail natural position. */
function toNaturalDetail(position: string): PosDetail {
  const upper = position.trim().toUpperCase();
  if (upper in POSITION_DETAILS) return upper as PosDetail;

  const side = upper.match(/^(R|L)(?=[A-Z])/)?.[1] as "R" | "L" | undefined;
  const expanded = expandCoarseToDetail(upper);

  if (side) {
    const sideMatch = expanded.find((code) => POSITION_DETAILS[code].side === side);
    if (sideMatch) return sideMatch;
  }

  return expanded[0]!;
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
    scenario.players.forEach((player) => {
      total++;
      const oldNatural = player.naturalPosition;
      const oldPositions = player.positions ?? [oldNatural];

      const naturalDetail = toNaturalDetail(oldNatural);

      const detailPositions: PosDetail[] = [];
      for (const pos of oldPositions) {
        detailPositions.push(...expandCoarseToDetail(pos));
      }
      const uniqueDetail = [...new Set(detailPositions)] as PosDetail[];

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
