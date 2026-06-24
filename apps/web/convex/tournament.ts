import { v } from "convex/values";
import { mutation, query, internalMutation, type MutationCtx } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  autoFillLineup,
  initBuildState,
  replayAndValidate,
  resolveDuel,
  type BuildAction,
  type ResolvedSide,
  type Side,
  type Tactic,
} from "7a0-engine/dist";
import { duelCatalog } from "./duelCatalog";

const STALE_MS = 30_000; // heartbeat is every ~10s; 3x that is comfortably stale
const FILL_TIMEOUT_MS = 60_000; // how long a stalled pool waits before CPU bot-fill
const QUEUE_SCAN_LIMIT = 20;
const POOL_SIZE = 8;
const GROUP_PAIRS: readonly [number, number][] = [
  [0, 1],
  [0, 2],
  [0, 3],
  [1, 2],
  [1, 3],
  [2, 3],
];

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

function shuffled<T>(items: readonly T[]): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
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

/** Resolve one entry's authoritative Build state for a specific fixture's side. */
function resolveEntrySide(entry: Entry, side: Side): ResolvedSide {
  if (entry.kind === "cpu") {
    const state = autoFillLineup(
      duelCatalog,
      initBuildState(duelCatalog, entry.seed, side, entry.scenarioId),
    );
    return { buildState: state, tactic: "balanced" };
  }
  const actions = JSON.parse(entry.row.actionsJson) as BuildAction[];
  const replay = replayAndValidate(duelCatalog, {
    seed: entry.row.seed,
    side,
    formationId: entry.row.formationId,
    actions,
    tactic: entry.row.tactic,
  });
  if (replay.ok) return { buildState: replay.state, tactic: entry.row.tactic };
  // Re-validated at joinQueue time for each player individually; this only
  // guards a corrupted row by falling back to an auto-filled empty draft.
  const fallback = replayAndValidate(duelCatalog, {
    seed: entry.row.seed,
    side,
    formationId: entry.row.formationId,
    actions: [],
    tactic: entry.row.tactic,
  });
  if (!fallback.ok) throw new Error("could not reconstruct lineup");
  return { buildState: fallback.state, tactic: entry.row.tactic };
}

/** Pick `n` distinct real historical squads for CPU bot-fill. */
function pickBotEntries(n: number): Entry[] {
  return shuffled(duelCatalog.scenarios)
    .slice(0, n)
    .map((scenario, i) => ({
      kind: "cpu" as const,
      scenarioId: scenario.id,
      name: `${scenario.team} ${scenario.cup}`,
      seed: `bot:${scenario.id}:${Date.now()}:${i}`,
    }));
}

interface MatchRow {
  stage: "group" | "semi" | "final";
  groupIndex?: number;
  homeSlot: number;
  awaySlot: number;
  seed: string;
  timelineJson: string;
  gf: number;
  ga: number;
  winnerSlot?: number;
}

/** Standings table for one group from its (already-played) fixtures. */
function computeStandings(
  groupIndex: number,
  matches: readonly Pick<MatchRow, "groupIndex" | "homeSlot" | "awaySlot" | "gf" | "ga" | "winnerSlot">[],
): { slot: number; points: number; gf: number; ga: number; gd: number; played: number }[] {
  const base = groupIndex * 4;
  const table = new Map<number, { points: number; gf: number; ga: number; played: number }>();
  for (let i = 0; i < 4; i++) table.set(base + i, { points: 0, gf: 0, ga: 0, played: 0 });
  for (const m of matches) {
    if (m.groupIndex !== groupIndex) continue;
    const home = table.get(m.homeSlot)!;
    const away = table.get(m.awaySlot)!;
    home.gf += m.gf;
    home.ga += m.ga;
    home.played += 1;
    away.gf += m.ga;
    away.ga += m.gf;
    away.played += 1;
    if (m.winnerSlot === undefined) {
      home.points += 1;
      away.points += 1;
    } else if (m.winnerSlot === m.homeSlot) {
      home.points += 3;
    } else {
      away.points += 3;
    }
  }
  return [...table.entries()]
    .map(([slot, t]) => ({ slot, ...t, gd: t.gf - t.ga }))
    .sort((a, b) => b.points - a.points || b.gd - a.gd || b.gf - a.gf);
}

/**
 * Resolve a full 8-player World Cup from exactly 8 entries (human and/or CPU
 * bot): shuffle into 2 groups of 4, play every group fixture, seed the
 * knockout bracket from the standings, play the semis and final. Everything
 * is decided and stored in this one mutation — no live timers.
 */
async function startTournament(ctx: MutationCtx, entries: readonly Entry[]): Promise<Id<"tournaments">> {
  const seats = shuffled(entries);
  const tournamentSeed = randomSeed();
  const tournamentId = await ctx.db.insert("tournaments", {
    seed: tournamentSeed,
    createdAt: Date.now(),
    championSlot: -1,
  });

  for (let slot = 0; slot < seats.length; slot++) {
    const entry = seats[slot]!;
    await ctx.db.insert("participants", {
      tournamentId,
      slot,
      groupIndex: slot < 4 ? 0 : 1,
      kind: entry.kind,
      playerId: entry.kind === "human" ? entry.row.playerId : undefined,
      name: entry.kind === "human" ? entry.row.name : entry.name,
      scenarioId: entry.kind === "cpu" ? entry.scenarioId : undefined,
    });
  }

  async function playMatch(
    homeSlot: number,
    awaySlot: number,
    stage: MatchRow["stage"],
    groupIndex: number | undefined,
    fixtureTag: string,
    knockout: boolean,
  ): Promise<MatchRow> {
    const home = resolveEntrySide(seats[homeSlot]!, "home");
    const away = resolveEntrySide(seats[awaySlot]!, "away");
    const fixtureSeed = `${tournamentSeed}:${fixtureTag}`;
    const { result, timeline } = resolveDuel(duelCatalog, {
      seed: fixtureSeed,
      home,
      away,
      knockout,
    });
    const [hg, ag] = result.score;
    let winnerSlot: number | undefined;
    if (result.winner === "draw") {
      if (knockout) throw new Error("knockout fixture resolved to an unresolved draw");
    } else {
      winnerSlot = result.winner === "home" ? homeSlot : awaySlot;
    }
    const row: MatchRow = {
      stage,
      groupIndex,
      homeSlot,
      awaySlot,
      seed: fixtureSeed,
      timelineJson: JSON.stringify(timeline),
      gf: hg,
      ga: ag,
      winnerSlot,
    };
    await ctx.db.insert("matches", { tournamentId, createdAt: Date.now(), ...row });
    return row;
  }

  const groupMatches: MatchRow[] = [];
  for (let g = 0; g < 2; g++) {
    const base = g * 4;
    for (const [a, b] of GROUP_PAIRS) {
      const row = await playMatch(base + a, base + b, "group", g, `g${g}:${a}-${b}`, false);
      groupMatches.push(row);
    }
  }

  const standingsA = computeStandings(0, groupMatches);
  const standingsB = computeStandings(1, groupMatches);

  const sf1 = await playMatch(standingsA[0]!.slot, standingsB[1]!.slot, "semi", undefined, "sf1", true);
  const sf2 = await playMatch(standingsB[0]!.slot, standingsA[1]!.slot, "semi", undefined, "sf2", true);
  const final = await playMatch(sf1.winnerSlot!, sf2.winnerSlot!, "final", undefined, "final", true);

  for (const entry of seats) {
    if (entry.kind === "human") {
      await ctx.db.patch(entry.row._id, { tournamentId });
    }
  }
  await ctx.db.patch(tournamentId, { championSlot: final.winnerSlot! });

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
    // Throws (and aborts the mutation) on a tampered/illegal log — the
    // player is still present, so just reject and let them fix the draft.
    validateSubmission(args);

    // Clear out any leftover row from a previous session (re-entry safety)
    // before scanning, so we never count ourselves twice.
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

    // A resolved tournament's row is patched with `tournamentId`, not
    // deleted (the client cleans it up once it reaches reveal) — it must
    // not count as "still waiting", or it can wrongly mask an empty pool
    // and skip scheduling the bot-fill backstop for the next one.
    const live: Doc<"queue">[] = [];
    for (const row of waiting) {
      if (row.tournamentId) continue;
      const stale = now - row.lastSeen > STALE_MS;
      if (stale) {
        // Opportunistic cleanup of abandoned entries encountered in the scan.
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
 * from real historical squads and resolve the tournament. Idempotent and
 * safe to fire redundantly — it only acts when the timeout has elapsed.
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
      if (row.tournamentId) continue; // already resolved, awaiting client cleanup
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
    if (now - oldest.joinedAt < FILL_TIMEOUT_MS) return null; // not timed out yet

    const entries: Entry[] = [
      ...live.map((row): Entry => ({ kind: "human", row })),
      ...pickBotEntries(POOL_SIZE - live.length),
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
        gf: m.gf,
        ga: m.ga,
        winnerSlot: m.winnerSlot,
        timeline: JSON.parse(m.timelineJson) as unknown,
      })),
      standings,
    };
  },
});
