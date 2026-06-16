/**
 * M1 verification CLI: run the engine → build the timeline → print the Fast
 * text ticker. The printed scoreline always equals the sum of GOAL lines, which
 * is exactly the reconciliation guarantee the timeline provides.
 *
 *   pnpm sim --home 91 --away 76 --seed demo123
 *   pnpm sim --home 88 --phase final --seed cup-run
 */

import {
  campaignOpponentOverall,
  isKnockoutPhase,
  simulateMatch,
  type TeamStrength,
} from "../engine.js";
import { defaultLineup } from "../lineup.js";
import { generateTimeline } from "../timeline/generate.js";
import { toFastText } from "../consumers/fastText.js";
import type { CampaignPhase } from "../constants.js";

interface Args {
  home: number;
  away: number;
  seed: string;
  knockout: boolean;
  phase?: CampaignPhase;
}

function parseArgs(argv: string[]): Args {
  const args: Args = { home: 85, away: 76, seed: "demo", knockout: false };
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

function strength(overall: number): TeamStrength {
  // CLI has no chemistry/tactics (M3); use the overall flat for attack/defense.
  return { attack: overall, defense: overall, overall };
}

function main(): void {
  const args = parseArgs(process.argv.slice(2));
  const home = strength(args.home);
  const away = strength(args.away);

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
    `λ: HOME ${result.lambda[0].toFixed(2)}  AWAY ${result.lambda[1].toFixed(2)}   events: ${timeline.events.length}   duration: ${(timeline.durationMs / 1000).toFixed(1)}s\n`,
  );

  for (const line of toFastText(timeline, { labels })) {
    console.log("  " + line);
  }

  const w =
    result.winner === "draw" ? "Draw" : `${labels[result.winner]} win`;
  console.log(`\nResult: ${result.score[0]}–${result.score[1]}  (${w})\n`);
}

main();
