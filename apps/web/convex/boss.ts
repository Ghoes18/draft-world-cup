import { v } from "convex/values";
import { query } from "./_generated/server";
import { authedMutation, authedQuery } from "./lib/customFunctions";
import {
  bossForWeek,
  bossSeed,
  buildMatchOutcome,
  isoWeekKey,
  replayAndValidate,
  resolveBossBuildState,
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

const difficultyValidator = v.union(v.literal("hard"), v.literal("veryHard"));

const bossViewValidator = v.object({
  weekKey: v.string(),
  id: v.string(),
  name: v.string(),
  subtitle: v.string(),
  difficulty: difficultyValidator,
  featuredPlayers: v.array(v.string()),
  tactic: tacticValidator,
});

const WEEK_ATTEMPTS_SCAN = 16; // ≤7 attempts per player per week

function bossViewForWeek(weekKey: string) {
  const definition = bossForWeek(weekKey);
  return {
    weekKey,
    id: definition.id,
    name: definition.name,
    subtitle: definition.subtitle,
    difficulty: definition.difficulty,
    featuredPlayers: [...definition.featuredPlayers],
    tactic: definition.tactic,
  };
}

/** Fixed Boss away XI for the week — identical for every challenger. */
function bossAwaySide(weekKey: string) {
  const definition = bossForWeek(weekKey);
  return {
    buildState: resolveBossBuildState(gameCatalog, definition, weekKey, "away"),
    tactic: definition.tactic,
  };
}

/** Reactive: this week's thematic Boss squad. */
export const currentBoss = query({
  args: {},
  returns: bossViewValidator,
  handler: async () => {
    return bossViewForWeek(isoWeekKey());
  },
});

/** Reactive: have I used today's attempt, and my best result this week? */
export const myBossStatus = authedQuery({
  args: {},
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
  handler: async (ctx) => {
    const { playerId } = ctx;
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
export const challengeBoss = authedMutation({
  args: {
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
    const { playerId } = ctx;
    const weekKey = isoWeekKey();
    const dateKey = utcDateKey();

    const already = await ctx.db
      .query("bossAttempts")
      .withIndex("by_player_date", (q) =>
        q.eq("playerId", playerId).eq("dateKey", dateKey),
      )
      .unique();
    if (already) throw new Error("BOSS_ALREADY_TRIED_TODAY");

    let actions: BuildAction[];
    try {
      actions = JSON.parse(args.actionsJson) as BuildAction[];
    } catch {
      throw new Error("BOSS_MALFORMED_BUILD");
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
        `BOSS_INVALID_BUILD:${replay.errors.map((e) => e.message).join(", ")}`,
      );
    }

    // Per-attempt match seed (Boss XI stays fixed via `bossAwaySide`).
    const matchSeed = `${bossSeed(weekKey)}:${playerId}:${dateKey}`;
    const { result, timeline, finalStates } = resolveDuel(gameCatalog, {
      seed: matchSeed,
      home: { buildState: replay.state, tactic: args.tactic },
      away: bossAwaySide(weekKey),
      knockout: true,
    });

    const [gf, ga] = result.score;
    const beat = result.winner === "home";

    await ctx.db.insert("bossAttempts", {
      playerId,
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
      playerId,
      outcome,
      dateKey,
    );

    return { gf, ga, beat, timeline, missionsCompleted: completed };
  },
});
