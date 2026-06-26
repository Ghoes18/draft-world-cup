/**
 * M1 verification CLI: run the engine → build the timeline → print the Fast
 * text ticker. The printed scoreline always equals the sum of GOAL lines, which
 * is exactly the reconciliation guarantee the timeline provides.
 *
 *   pnpm sim --home 91 --away 76 --seed demo123
 *   pnpm sim --home 88 --phase final --seed cup-run
 *   pnpm sim --home 88 --away 76 --tactic offensive --seed demo
 */

import {
  campaignOpponentOverall,
  isKnockoutPhase,
  simulateMatch,
  type TeamStrength,
} from "../engine.js";
import { effectiveStrength } from "../strength.js";
import { defaultLineup } from "../lineup.js";
import { generateTimeline } from "../timeline/generate.js";
import { toFastText } from "../consumers/fastText.js";
import { computeMatchStats, type TeamStats } from "../consumers/stats.js";
import type { CampaignPhase, Tactic } from "../constants.js";

interface Args {
  home: number;
  away: number;
  seed: string;
  knockout: boolean;
  phase?: CampaignPhase;
  tactic: Tactic;
}

const TACTICS: readonly Tactic[] = ["offensive", "balanced", "defensive"];

function parseArgs(argv: string[]): Args {
  const args: Args = {
    home: 85,
    away: 76,
    seed: "demo",
    knockout: false,
    tactic: "balanced",
  };
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    switch (arg) {
      case "--home":
        args.home = Number(argv[++i]);
        break;
      case "--away":
        args.away = Number(argv[++i]);
        break;
      case "--seed":
        args.seed = String(argv[++i]);
        break;
      case "--phase":
        args.phase = argv[++i] as CampaignPhase;
        break;
      case "--knockout":
        args.knockout = true;
        break;
      case "--tactic": {
        const t = String(argv[++i]) as Tactic;
        if (!TACTICS.includes(t)) {
          console.error(`Unknown tactic: ${t} (use ${TACTICS.join("|")})`);
          process.exit(1);
        }
        args.tactic = t;
        break;
      }
      default:
        if (arg?.startsWith("--")) {
          console.error(`Unknown flag: ${arg}`);
          process.exit(1);
        }
    }
  }
  if (args.phase) {
    args.away = campaignOpponentOverall(args.phase);
    args.knockout = isKnockoutPhase(args.phase);
  }
  return args;
}

function baseStrength(overall: number): TeamStrength {
  // No squad data in the CLI; use the overall flat for attack/midfield/defense.
  return { attack: overall, midfield: overall, defense: overall, overall };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  // Home gets tactics; away stays neutral (its own flags TBD).
  const home = effectiveStrength(baseStrength(args.home), {
    tactic: args.tactic,
  });
  const away = baseStrength(args.away);

  const result = simulateMatch({
    home,
    away,
    seed: args.seed,
    knockout: args.knockout,
  });

  const timeline = generateTimeline({
    result,
    seed: args.seed,
    scenario: { team: "Home XI", cup: 0 },
    lineups: { home: defaultLineup("home"), away: defaultLineup("away") },
  });

  const labels = { home: "HOME", away: "AWAY" };
  const phaseLabel = args.phase ? ` · ${args.phase}` : "";
  const ko = args.knockout ? " · knockout" : "";

  console.log(
    `\n7a0 — seed "${args.seed}"  (HOME ${args.home} vs AWAY ${args.away}${phaseLabel}${ko})`,
  );
  console.log(
    `HOME build: tactic ${args.tactic}  →  eff ATK ${home.attack} MID ${home.midfield} DEF ${home.defense} OVR ${home.overall}`,
  );
  console.log(
    `λ: HOME ${result.lambda[0].toFixed(2)}  AWAY ${result.lambda[1].toFixed(2)}   events: ${timeline.events.length}   duration: ${(timeline.durationMs / 1000).toFixed(1)}s\n`,
  );

  for (const line of toFastText(timeline, { labels })) {
    console.log("  " + line);
  }

  const w =
    result.winner === "draw" ? "Draw" : `${labels[result.winner]} win`;
  console.log(`\nResult: ${result.score[0]}–${result.score[1]}  (${w})\n`);

  printStats(computeMatchStats(timeline), labels);
}

/** Side-by-side match statistics derived from the timeline (M3). */
function printStats(
  stats: { home: TeamStats; away: TeamStats },
  labels: { home: string; away: string },
): void {
  const rows: [string, string, string][] = [
    ["Possession", `${stats.home.possession}%`, `${stats.away.possession}%`],
    ["Shots", `${stats.home.shots}`, `${stats.away.shots}`],
    ["On target", `${stats.home.shotsOnTarget}`, `${stats.away.shotsOnTarget}`],
    ["Corners", `${stats.home.corners}`, `${stats.away.corners}`],
    ["Penalties", `${stats.home.penalties}`, `${stats.away.penalties}`],
    ["Passes", `${stats.home.passes}`, `${stats.away.passes}`],
    ["xG", stats.home.xg.toFixed(1), stats.away.xg.toFixed(1)],
  ];

  console.log("Statistics");
  console.log(`  ${pad(labels.home, 8, "end")}          ${labels.away}`);
  for (const [label, h, a] of rows) {
    console.log(
      `  ${pad(h, 6, "start")}  ${pad(label, 12, "end")}  ${pad(a, 6, "end")}`,
    );
  }
  console.log("");
}

function pad(s: string, width: number, side: "start" | "end"): string {
  return side === "start" ? s.padStart(width) : s.padEnd(width);
}

main();
