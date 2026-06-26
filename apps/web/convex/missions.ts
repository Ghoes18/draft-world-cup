import { v } from "convex/values";
import { query, type MutationCtx } from "./_generated/server";
import {
  activeMissions,
  applyMatchToStats,
  emptyPlayerStats,
  evaluateMission,
  missionTarget,
  utcDateKey,
  type MatchOutcome,
  type MissionDef,
  type PlayerStats,
} from "7a0-engine/dist";

const PROGRESS_SCAN_LIMIT = 256;

/** Period a mission's progress is bucketed under. Daily missions reset per UTC
 *  day; persistent missions keep a single lifetime row. */
function periodKeyFor(def: MissionDef, dateKey: string): string {
  return def.type === "daily" ? dateKey : "all";
}

/**
 * Fold one server-resolved match into a player's mission progress. Shared by
 * the solo (`recordMatch`) and Boss (`challengeBoss`) mutations — never trusts
 * a client-reported score. Returns the ids of missions newly completed by this
 * match (for a "mission complete" toast).
 */
export async function applyMatchToMissions(
  ctx: MutationCtx,
  playerId: string,
  outcome: MatchOutcome,
  dateKey: string,
): Promise<{ completed: string[] }> {
  const now = Date.now();

  // 1. Fold cumulative facts into playerStats.
  const statsRow = await ctx.db
    .query("playerStats")
    .withIndex("by_player", (q) => q.eq("playerId", playerId))
    .unique();
  const prior: PlayerStats = statsRow
    ? {
        totalGoals: statsRow.totalGoals,
        wins: statsRow.wins,
        cleanSheets: statsRow.cleanSheets,
        legendIds: statsRow.legendIds,
        nations: statsRow.nations,
      }
    : emptyPlayerStats();
  const next = applyMatchToStats(prior, outcome);
  if (statsRow) {
    await ctx.db.patch(statsRow._id, { ...next, updatedAt: now });
  } else {
    await ctx.db.insert("playerStats", { playerId, ...next, updatedAt: now });
  }

  // 2. Re-evaluate every active mission and upsert its progress row. Progress
  //    only ever moves forward; a completed mission is never downgraded.
  const completed: string[] = [];
  for (const def of activeMissions(dateKey)) {
    const periodKey = periodKeyFor(def, dateKey);
    const evaluation = evaluateMission(def, outcome, next);
    const existing = await ctx.db
      .query("missionProgress")
      .withIndex("by_player_mission_period", (q) =>
        q.eq("playerId", playerId).eq("missionId", def.id).eq("periodKey", periodKey),
      )
      .unique();

    const wasCompleted = existing?.status === "completed";
    const isCompleted = wasCompleted || evaluation.completed;
    const progress = isCompleted
      ? evaluation.target
      : Math.max(existing?.progress ?? 0, evaluation.progress);
    const fields = {
      progress,
      target: evaluation.target,
      status: isCompleted ? ("completed" as const) : ("in_progress" as const),
      completedAt: isCompleted ? (existing?.completedAt ?? now) : undefined,
      updatedAt: now,
    };

    if (existing) {
      await ctx.db.patch(existing._id, fields);
    } else {
      await ctx.db.insert("missionProgress", {
        playerId,
        missionId: def.id,
        periodKey,
        type: def.type,
        ...fields,
      });
    }
    if (isCompleted && !wasCompleted) completed.push(def.id);
  }

  return { completed };
}

/** Reactive: today's daily missions + all persistent missions, with progress. */
export const myMissions = query({
  args: { playerId: v.string() },
  returns: v.array(
    v.object({
      id: v.string(),
      type: v.union(v.literal("daily"), v.literal("persistent")),
      category: v.union(
        v.literal("composition"),
        v.literal("result"),
        v.literal("career"),
      ),
      title: v.string(),
      description: v.string(),
      progress: v.number(),
      target: v.number(),
      completed: v.boolean(),
    }),
  ),
  handler: async (ctx, { playerId }) => {
    const dateKey = utcDateKey();
    const defs = activeMissions(dateKey);
    const rows = await ctx.db
      .query("missionProgress")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .take(PROGRESS_SCAN_LIMIT);
    const byKey = new Map(rows.map((r) => [`${r.missionId}:${r.periodKey}`, r]));

    return defs.map((def) => {
      const periodKey = periodKeyFor(def, dateKey);
      const row = byKey.get(`${def.id}:${periodKey}`);
      return {
        id: def.id,
        type: def.type,
        category: def.category,
        title: def.title,
        description: def.description,
        progress: row?.progress ?? 0,
        target: row?.target ?? missionTarget(def),
        completed: row?.status === "completed",
      };
    });
  },
});
