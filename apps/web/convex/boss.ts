import { v } from "convex/values";
import { mutation, query } from "./_generated/server";
import {
  autoFillLineup,
  bossSeed,
  buildMatchOutcome,
  drawScenario,
  initBuildState,
  isoWeekKey,
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

const WEEK_ATTEMPTS_SCAN = 16; // ≤7 attempts per player per week

/** The weekly Boss squad (same for everyone all week), drawn from the week seed. */
function bossScenarioFor(weekKey: string) {
  return drawScenario(gameCatalog, bossSeed(weekKey));
}

/** The Boss's fixed weekly XI — identical for every challenger. */
function bossAwaySide(weekKey: string, scenarioId: string) {
  return {
    buildState: autoFillLineup(
      gameCatalog,
      initBuildState(gameCatalog, bossSeed(weekKey), "away", scenarioId),
    ),
    tactic: "balanced" as const,
  };
}

/** Reactive: this week's Boss scenario (team + Cup). */
export const currentBoss = query({
  args: {},
  returns: v.object({
    weekKey: v.string(),
    scenario: v.object({ team: v.string(), cup: v.number() }),
  }),
  handler: async () => {
    const weekKey = isoWeekKey();
    const scenario = bossScenarioFor(weekKey);
    return { weekKey, scenario: { team: scenario.team, cup: scenario.cup } };
  },
});

/** Reactive: have I used today's attempt, and my best result this week? */
export const myBossStatus = query({
  args: { playerId: v.string() },
  returns: v.object({
    weekKey: v.string(),
    triedToday: v.boolean(),
    today: v.union(
      v.null(),
      v.object({ gf: v.number(), ga: v.number(), beat: v.boolean() }),
    ),
    bestThisWeek: v.union(
      v.null(),
      v.object({ gf: v.number(), ga: v.number(), beat: v.boolean() }),
    ),
  }),
  handler: async (ctx, { playerId }) => {
    const weekKey = isoWeekKey();
    const dateKey = utcDateKey();

    const todayRow = await ctx.db
      .query("bossAttempts")
      .withIndex("by_player_date", (q) =>
        q.eq("playerId", playerId).eq("dateKey", dateKey),
      )
      .unique();

    const weekRows = await ctx.db
      .query("bossAttempts")
      .withIndex("by_player_week", (q) =>
        q.eq("playerId", playerId).eq("weekKey", weekKey),
      )
      .take(WEEK_ATTEMPTS_SCAN);

    // Best = highest goal difference, then most goals scored.
    const best = weekRows.reduce<(typeof weekRows)[number] | null>((acc, r) => {
      if (!acc) return r;
      const dr = r.gf - r.ga;
      const da = acc.gf - acc.ga;
      if (dr > da || (dr === da && r.gf > acc.gf)) return r;
      return acc;
    }, null);

    return {
      weekKey,
      triedToday: todayRow !== null,
      today: todayRow ? { gf: todayRow.gf, ga: todayRow.ga, beat: todayRow.beat } : null,
      bestThisWeek: best ? { gf: best.gf, ga: best.ga, beat: best.beat } : null,
    };
  },
});

/**
 * Challenge the weekly Boss — one attempt per UTC day. Server-authoritative:
 * validates the submitted draft, resolves it head-to-head against the fixed
 * weekly Boss XI (knockout: a tie goes to penalties), stores the attempt, and
 * folds the outcome into mission progress (`beat-boss` only credits here).
 */
export const challengeBoss = mutation({
  args: {
    playerId: v.string(),
    seed: v.string(),
    formationId: v.string(),
    tactic: tacticValidator,
    actionsJson: v.string(),
  },
  returns: v.object({
    gf: v.number(),
    ga: v.number(),
    beat: v.boolean(),
    timeline: v.any(),
    missionsCompleted: v.array(v.string()),
  }),
  handler: async (ctx, args) => {
    const weekKey = isoWeekKey();
    const dateKey = utcDateKey();

    const already = await ctx.db
      .query("bossAttempts")
      .withIndex("by_player_date", (q) =>
        q.eq("playerId", args.playerId).eq("dateKey", dateKey),
      )
      .unique();
    if (already) throw new Error("You've already challenged the Boss today.");

    let actions: BuildAction[];
    try {
      actions = JSON.parse(args.actionsJson) as BuildAction[];
    } catch {
      throw new Error("Malformed build: actions could not be parsed");
    }
    const replay = replayAndValidate(gameCatalog, {
      seed: args.seed,
      side: "home",
      formationId: args.formationId,
      actions,
      tactic: args.tactic,
    });
    if (!replay.ok) {
      throw new Error(
        "Invalid build: " + replay.errors.map((e) => e.message).join(", "),
      );
    }

    const scenario = bossScenarioFor(weekKey);
    // Per-attempt match seed (boss XI stays fixed via `bossAwaySide`).
    const matchSeed = `${bossSeed(weekKey)}:${args.playerId}:${dateKey}`;
    const { result, timeline, finalStates } = resolveDuel(gameCatalog, {
      seed: matchSeed,
      home: { buildState: replay.state, tactic: args.tactic },
      away: bossAwaySide(weekKey, scenario.id),
      knockout: true,
    });

    const [gf, ga] = result.score;
    const beat = result.winner === "home";

    await ctx.db.insert("bossAttempts", {
      playerId: args.playerId,
      weekKey,
      dateKey,
      seed: matchSeed,
      formationId: args.formationId,
      tactic: args.tactic,
      actionsJson: args.actionsJson,
      timelineJson: JSON.stringify(timeline),
      gf,
      ga,
      beat,
      createdAt: Date.now(),
    });

    const outcome = buildMatchOutcome(gameCatalog, finalStates.home, result, {
      beatBoss: beat,
    });
    const { completed } = await applyMatchToMissions(
      ctx,
      args.playerId,
      outcome,
      dateKey,
    );

    return { gf, ga, beat, timeline, missionsCompleted: completed };
  },
});
