import { v } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  pickBotEntries,
  replayAndValidate,
  resolveWorldCup,
  computeStandings,
  type BuildAction,
  type ResolvedSide,
  type Side,
  type Tactic,
  type TournamentEntry,
} from "7a0-engine/dist";
import { duelCatalog } from "./duelCatalog";

const STALE_MS = 30_000; // heartbeat is every ~10s; 3x that is comfortably stale
const FILL_TIMEOUT_MS = 60_000; // how long a stalled pool waits before CPU bot-fill
const QUEUE_SCAN_LIMIT = 20;
const POOL_SIZE = 8;

const tacticValidator = v.union(
  v.literal("offensive"),
  v.literal("balanced"),
  v.literal("defensive"),
);
const stageValidator = v.union(
  v.literal("group"),
  v.literal("semi"),
  v.literal("final"),
);
const participantKindValidator = v.union(v.literal("human"), v.literal("cpu"));

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

/**
 * Validate a player's own draft submission before it ever enters the pool.
 * `side` is a placeholder here — per the engine, `side` only mirrors pitch
 * anchors cosmetically and never affects RNG, scenario draws, or eligibility,
 * so validating as "home" is equivalent to validating whatever side (and
 * however many fixtures) the player is eventually assigned.
 */
function validateSubmission(input: {
  seed: string;
  formationId: string;
  tactic: Tactic;
  actionsJson: string;
}) {
  let actions: BuildAction[];
  try {
    actions = JSON.parse(input.actionsJson) as BuildAction[];
  } catch {
    throw new Error("Malformed build: actions could not be parsed");
  }
  const replay = replayAndValidate(duelCatalog, {
    seed: input.seed,
    side: "home",
    formationId: input.formationId,
    actions,
    tactic: input.tactic,
  });
  if (!replay.ok) {
    throw new Error(
      "Invalid build: " + replay.errors.map((e) => e.message).join(", "),
    );
  }
  return actions;
}

/** One of the 8 tournament seats, before slot assignment. */
type Entry =
  | { kind: "human"; row: Doc<"queue"> }
  | { kind: "cpu"; scenarioId: string; name: string; seed: string };

function resolveHumanRowSide(row: Doc<"queue">, side: Side): ResolvedSide {
  const actions = JSON.parse(row.actionsJson) as BuildAction[];
  const replay = replayAndValidate(duelCatalog, {
    seed: row.seed,
    side,
    formationId: row.formationId,
    actions,
    tactic: row.tactic,
  });
  if (replay.ok) return { buildState: replay.state, tactic: row.tactic };
  const fallback = replayAndValidate(duelCatalog, {
    seed: row.seed,
    side,
    formationId: row.formationId,
    actions: [],
    tactic: row.tactic,
  });
  if (!fallback.ok) throw new Error("could not reconstruct lineup");
  return { buildState: fallback.state, tactic: row.tactic };
}

function toTournamentEntry(entry: Entry): TournamentEntry {
  if (entry.kind === "cpu") {
    return {
      kind: "cpu",
      scenarioId: entry.scenarioId,
      name: entry.name,
      seed: entry.seed,
    };
  }
  return {
    kind: "human",
    name: entry.row.name,
    playerId: entry.row.playerId,
    resolve: (side: Side) => resolveHumanRowSide(entry.row, side),
  };
}

/**
 * Resolve a full 8-player World Cup from exactly 8 entries (human and/or CPU
 * bot) and persist every fixture to Convex.
 */
async function startTournament(ctx: MutationCtx, entries: readonly Entry[]): Promise<Id<"tournaments">> {
  const tournamentSeed = randomSeed();
  const resolved = resolveWorldCup(
    duelCatalog,
    entries.map(toTournamentEntry),
    tournamentSeed,
  );

  const tournamentId = await ctx.db.insert("tournaments", {
    seed: resolved.seed,
    createdAt: Date.now(),
    championSlot: resolved.championSlot,
  });

  for (const p of resolved.participants) {
    await ctx.db.insert("participants", {
      tournamentId,
      slot: p.slot,
      groupIndex: p.groupIndex,
      kind: p.kind,
      playerId: p.playerId,
      name: p.name,
      scenarioId: p.scenarioId,
    });
  }

  for (const m of resolved.matches) {
    await ctx.db.insert("matches", {
      tournamentId,
      createdAt: Date.now(),
      stage: m.stage,
      groupIndex: m.groupIndex,
      homeSlot: m.homeSlot,
      awaySlot: m.awaySlot,
      seed: m.seed,
      timelineJson: JSON.stringify(m.timeline),
      gf: m.gf,
      ga: m.ga,
      winnerSlot: m.winnerSlot,
    });
  }

  for (const entry of entries) {
    if (entry.kind === "human") {
      await ctx.db.patch(entry.row._id, { tournamentId });
    }
  }

  return tournamentId;
}

/**
 * Join the tournament pool. The moment the pool reaches 8 (live) players,
 * the whole tournament is resolved immediately — every build is already
 * validated, so there is nothing left to wait for.
 */
export const joinQueue = mutation({
  args: {
    playerId: v.string(),
    name: v.string(),
    seed: v.string(),
    formationId: v.string(),
    tactic: tacticValidator,
    actionsJson: v.string(),
  },
  returns: v.union(
    v.object({ status: v.literal("waiting"), waitingCount: v.number(), poolSize: v.number() }),
    v.object({ status: v.literal("matched"), tournamentId: v.id("tournaments") }),
  ),
  handler: async (ctx, args) => {
    validateSubmission(args);

    const mine = await ctx.db
      .query("queue")
      .withIndex("by_player", (q) => q.eq("playerId", args.playerId))
      .unique();
    if (mine) await ctx.db.delete(mine._id);

    const now = Date.now();
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_joinedAt")
      .order("asc")
      .take(QUEUE_SCAN_LIMIT);

    const live: Doc<"queue">[] = [];
    for (const row of waiting) {
      if (row.tournamentId) continue;
      const stale = now - row.lastSeen > STALE_MS;
      if (stale) {
        await ctx.db.delete(row._id);
        continue;
      }
      live.push(row);
    }
    const wasEmpty = live.length === 0;

    const myRowId = await ctx.db.insert("queue", {
      playerId: args.playerId,
      name: args.name,
      seed: args.seed,
      formationId: args.formationId,
      tactic: args.tactic,
      actionsJson: args.actionsJson,
      joinedAt: now,
      lastSeen: now,
    });

    if (wasEmpty) {
      await ctx.scheduler.runAfter(FILL_TIMEOUT_MS, internal.tournament.tryStartTournament, {});
    }

    if (live.length + 1 >= POOL_SIZE) {
      const myRow = (await ctx.db.get(myRowId))!;
      const entries: Entry[] = [...live, myRow].slice(0, POOL_SIZE).map((row) => ({ kind: "human", row }));
      const tournamentId = await startTournament(ctx, entries);
      return { status: "matched" as const, tournamentId };
    }

    await ctx.scheduler.runAfter(STALE_MS * 2, internal.tournament.expireIfStale, {
      playerId: args.playerId,
    });
    return { status: "waiting" as const, waitingCount: live.length + 1, poolSize: POOL_SIZE };
  },
});

/**
 * Scheduled backstop: if a pool has stalled (1-7 live players, oldest has
 * been waiting at least `FILL_TIMEOUT_MS`), top it up with CPU bots drafted
 * from real historical squads and resolve the tournament.
 */
export const tryStartTournament = internalMutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    const now = Date.now();
    const waiting = await ctx.db
      .query("queue")
      .withIndex("by_joinedAt")
      .order("asc")
      .take(QUEUE_SCAN_LIMIT);

    const live: Doc<"queue">[] = [];
    for (const row of waiting) {
      if (row.tournamentId) continue;
      if (now - row.lastSeen > STALE_MS) {
        await ctx.db.delete(row._id);
        continue;
      }
      live.push(row);
    }

    if (live.length === 0) return null;

    if (live.length >= POOL_SIZE) {
      const entries: Entry[] = live.slice(0, POOL_SIZE).map((row) => ({ kind: "human", row }));
      await startTournament(ctx, entries);
      return null;
    }

    const oldest = live[0]!;
    if (now - oldest.joinedAt < FILL_TIMEOUT_MS) return null;

    const tournamentSeed = randomSeed();
    const botEntries: Entry[] = pickBotEntries(duelCatalog, POOL_SIZE - live.length, tournamentSeed)
      .filter((b): b is Extract<TournamentEntry, { kind: "cpu" }> => b.kind === "cpu")
      .map((b) => ({
        kind: "cpu" as const,
        scenarioId: b.scenarioId,
        name: b.name,
        seed: b.seed,
      }));
    const entries: Entry[] = [
      ...live.map((row): Entry => ({ kind: "human", row })),
      ...botEntries,
    ];
    await startTournament(ctx, entries);
    return null;
  },
});

/** Cancel an active search, or clear a consumed tournament pointer. */
export const leaveQueue = mutation({
  args: { playerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("queue")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .unique();
    if (row) await ctx.db.delete(row._id);
    return null;
  },
});

/** Heartbeat while waiting, so abandoned entries can be detected. */
export const heartbeat = mutation({
  args: { playerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("queue")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .unique();
    if (row) await ctx.db.patch(row._id, { lastSeen: Date.now() });
    return null;
  },
});

/** Scheduled backstop: delete a queue row if its heartbeat never advanced. */
export const expireIfStale = internalMutation({
  args: { playerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("queue")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .unique();
    if (row && Date.now() - row.lastSeen > STALE_MS && !row.tournamentId) {
      await ctx.db.delete(row._id);
    }
    return null;
  },
});

/** Reactive: am I still waiting, freshly matched, or out of the pool? */
export const myQueueStatus = query({
  args: { playerId: v.string() },
  returns: v.union(
    v.object({ status: v.literal("idle") }),
    v.object({ status: v.literal("waiting"), waitingCount: v.number(), poolSize: v.number() }),
    v.object({ status: v.literal("matched"), tournamentId: v.id("tournaments") }),
  ),
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("queue")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .unique();
    if (!row) return { status: "idle" as const };
    if (row.tournamentId) return { status: "matched" as const, tournamentId: row.tournamentId };

    const now = Date.now();
    const waiting = await ctx.db.query("queue").withIndex("by_joinedAt").take(QUEUE_SCAN_LIMIT);
    const waitingCount = waiting.filter((r) => !r.tournamentId && now - r.lastSeen <= STALE_MS).length;
    return { status: "waiting" as const, waitingCount, poolSize: POOL_SIZE };
  },
});

/** Reactive: the full resolved tournament a player just landed in. */
export const tournamentState = query({
  args: { tournamentId: v.id("tournaments") },
  returns: v.union(
    v.null(),
    v.object({
      tournamentId: v.id("tournaments"),
      championSlot: v.number(),
      participants: v.array(
        v.object({
          slot: v.number(),
          groupIndex: v.number(),
          kind: participantKindValidator,
          playerId: v.optional(v.string()),
          name: v.string(),
          scenarioId: v.optional(v.string()),
        }),
      ),
      matches: v.array(
        v.object({
          stage: stageValidator,
          groupIndex: v.optional(v.number()),
          homeSlot: v.number(),
          awaySlot: v.number(),
          seed: v.string(),
          gf: v.number(),
          ga: v.number(),
          winnerSlot: v.optional(v.number()),
          timeline: v.any(),
        }),
      ),
      standings: v.array(
        v.object({
          groupIndex: v.number(),
          table: v.array(
            v.object({
              slot: v.number(),
              points: v.number(),
              gf: v.number(),
              ga: v.number(),
              gd: v.number(),
              played: v.number(),
            }),
          ),
        }),
      ),
    }),
  ),
  handler: async (ctx, { tournamentId }) => {
    const tournament = await ctx.db.get(tournamentId);
    if (!tournament) return null;

    const participants = await ctx.db
      .query("participants")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();
    const matches = await ctx.db
      .query("matches")
      .withIndex("by_tournament", (q) => q.eq("tournamentId", tournamentId))
      .collect();

    const groupMatches = matches.filter((m) => m.stage === "group");
    const standings = [0, 1].map((groupIndex) => ({
      groupIndex,
      table: computeStandings(groupIndex, groupMatches),
    }));

    return {
      tournamentId,
      championSlot: tournament.championSlot,
      participants: participants
        .map((p) => ({
          slot: p.slot,
          groupIndex: p.groupIndex,
          kind: p.kind,
          playerId: p.playerId,
          name: p.name,
          scenarioId: p.scenarioId,
        }))
        .sort((a, b) => a.slot - b.slot),
      matches: matches.map((m) => ({
        stage: m.stage,
        groupIndex: m.groupIndex,
        homeSlot: m.homeSlot,
        awaySlot: m.awaySlot,
        seed: m.seed,
        gf: m.gf,
        ga: m.ga,
        winnerSlot: m.winnerSlot,
        timeline: JSON.parse(m.timelineJson) as unknown,
      })),
      standings,
    };
  },
});
