import { v } from "convex/values";
import { mutation } from "./_generated/server";
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
 * Record a finished *solo* match for mission progress. The client presents its
 * own (deterministic) local simulation for instant feedback; this mutation is
 * the server-authoritative source of truth — it re-validates the submitted
 * action log and re-resolves the match on the shared `gameCatalog`, so a
 * tampered score never earns mission credit. The seed-derived opponent is
 * reconstructed exactly as the solo client does (`app/page.tsx`).
 *
 * Invalid/illegal submissions are silently not credited (return `ok:false`) —
 * the player keeps their local result; only mission progress is withheld.
 */
export const recordMatch = mutation({
  args: {
    playerId: v.string(),
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

    // Reconstruct the seed-derived CPU opponent (mirrors the solo client).
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
      args.playerId,
      outcome,
      utcDateKey(),
    );
    return { ok: true, missionsCompleted: completed };
  },
});
