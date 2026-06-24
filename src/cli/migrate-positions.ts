/**
 * CLI: Migrate curated squad JSONs from coarse positions to detail positions.
 *
 * Usage: npx tsx src/cli/migrate-positions.ts [squad-dir]
 */

import { readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { assignSquadDetailPositions } from "../catalog/detailPositionsMigrate.js";

const SQUAD_DIR = process.argv[2] ?? "squads/curated";

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
    const beforePlayers = scenario.players;
    const migrated = assignSquadDetailPositions(beforePlayers);
    scenario.players = migrated.map((player, index) => {
      total++;
      const before = beforePlayers[index]!;
      if (
        before.naturalPosition !== player.naturalPosition ||
        JSON.stringify(before.positions ?? []) !==
          JSON.stringify(player.positions)
      ) {
        changed++;
      }
      return player;
    });
  }

  writeFileSync(filePath, JSON.stringify(data, null, 2));
  return { changed, total };
}

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
