import { v } from "convex/values";
import { authedMutation } from "./lib/customFunctions";
import {
  autoFillLineup,
  buildMatchOutcome,
  drawOpponentScenario,
  initBuildState,
  replayAndValidate,
  resolveDuel,
  utcDateKey,
  type BuildAction,
} from "7a0-engine/dist";
import { gameCatalog } from "./gameCatalog";
import { applyMatchToMissions } from "./missions";

const tacticValidator = v.union(
  v.literal("offensive"),
  v.literal("balanced"),
  v.literal("defensive"),
);

/**
 * Record a finished *solo* match for mission progress. Requires authentication.
 * The client presents its own (deterministic) local simulation for instant feedback;
 * this mutation re-validates the submitted action log server-side.
 */
export const recordMatch = authedMutation({
  args: {
    seed: v.string(),
    formationId: v.string(),
    tactic: tacticValidator,
    actionsJson: v.string(),
  },
  returns: v.object({
    ok: v.boolean(),
    missionsCompleted: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const { playerId } = ctx;
    let actions: BuildAction[];
    try {
      actions = JSON.parse(args.actionsJson) as BuildAction[];
    } catch {
      return { ok: false, missionsCompleted: [] };
    }

    const replay = replayAndValidate(gameCatalog, {
      seed: args.seed,
      side: "home",
      formationId: args.formationId,
      actions,
      tactic: args.tactic,
    });
    if (!replay.ok) return { ok: false, missionsCompleted: [] };

    const initial = initBuildState(
      gameCatalog,
      args.seed,
      "home",
      undefined,
      args.formationId,
    );
    const opponent = drawOpponentScenario(
      gameCatalog,
      args.seed,
      initial.currentScenarioId,
    );
    const awayBuild = autoFillLineup(
      gameCatalog,
      initBuildState(gameCatalog, `${args.seed}:away`, "away", opponent.id),
    );

    const { result, finalStates } = resolveDuel(gameCatalog, {
      seed: args.seed,
      home: { buildState: replay.state, tactic: args.tactic },
      away: { buildState: awayBuild, tactic: "balanced" },
      knockout: false,
    });

    const outcome = buildMatchOutcome(gameCatalog, finalStates.home, result, {
      beatBoss: false,
    });
    const { completed } = await applyMatchToMissions(
      ctx,
      playerId,
      outcome,
      utcDateKey(),
    );
    return { ok: true, missionsCompleted: completed };
  },
});
