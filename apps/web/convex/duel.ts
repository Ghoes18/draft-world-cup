import { v } from "convex/values";
import { mutation, query, internalMutation } from "./_generated/server";
import type { Doc, Id } from "./_generated/dataModel";
import { internal } from "./_generated/api";
import {
  DEFAULT_FORMATION_ID,
  drawFormationOptions,
  replayAndValidate,
  resolveDuel,
  type BuildAction,
  type Side,
  type Tactic,
} from "7a0-engine/dist";
import { duelCatalog } from "./duelCatalog";

const BUILD_TIMER_MS = 90_000; // MVP §9.6 (chosen)
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"; // no ambiguous chars

function randomCode(): string {
  let out = "";
  for (let i = 0; i < 5; i++) {
    out += CODE_ALPHABET[Math.floor(Math.random() * CODE_ALPHABET.length)];
  }
  return out;
}

function randomSeed(): string {
  return Math.random().toString(36).slice(2, 10);
}

async function playersOf(ctx: { db: any }, roomId: Id<"rooms">) {
  return await ctx.db
    .query("roomPlayers")
    .withIndex("by_room", (q: any) => q.eq("roomId", roomId))
    .collect();
}

async function playerRow(
  ctx: { db: any },
  roomId: Id<"rooms">,
  playerId: string,
): Promise<Doc<"roomPlayers"> | null> {
  return await ctx.db
    .query("roomPlayers")
    .withIndex("by_room_player", (q: any) =>
      q.eq("roomId", roomId).eq("playerId", playerId),
    )
    .unique();
}

/** Create a room and seat the host as "home". Returns the join code. */
export const createRoom = mutation({
  args: { playerId: v.string(), name: v.string() },
  returns: v.object({ code: v.string(), roomId: v.id("rooms") }),
  handler: async (ctx, { playerId, name }) => {
    // Find a code not currently in use.
    let code = randomCode();
    for (let i = 0; i < 5; i++) {
      const clash = await ctx.db
        .query("rooms")
        .withIndex("by_code", (q) => q.eq("code", code))
        .first();
      if (!clash) break;
      code = randomCode();
    }
    const roomId = await ctx.db.insert("rooms", {
      code,
      status: "lobby",
      hostId: playerId,
      createdAt: Date.now(),
    });
    await ctx.db.insert("roomPlayers", {
      roomId,
      playerId,
      name,
      seat: "home",
      presence: "connected",
      confirmed: false,
      lastSeen: Date.now(),
    });
    return { code, roomId };
  },
});

/** Join an existing room by code as "away" (or rejoin if already seated). */
export const joinRoom = mutation({
  args: { code: v.string(), playerId: v.string(), name: v.string() },
  returns: v.object({ roomId: v.id("rooms") }),
  handler: async (ctx, { code, playerId, name }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
    if (!room) throw new Error("Room not found");

    const existing = await playerRow(ctx, room._id, playerId);
    if (existing) {
      await ctx.db.patch(existing._id, {
        presence: "connected",
        lastSeen: Date.now(),
      });
      return { roomId: room._id };
    }

    const seated = await playersOf(ctx, room._id);
    if (seated.length >= 2) throw new Error("Room is full");

    await ctx.db.insert("roomPlayers", {
      roomId: room._id,
      playerId,
      name,
      seat: "away",
      presence: "connected",
      confirmed: false,
      lastSeen: Date.now(),
    });
    return { roomId: room._id };
  },
});

/** Heartbeat / presence update (also drives disconnect detection). */
export const setPresence = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    presence: v.optional(
      v.union(
        v.literal("connected"),
        v.literal("building"),
        v.literal("ready"),
        v.literal("disconnected"),
      ),
    ),
  },
  returns: v.null(),
  handler: async (ctx, { roomId, playerId, presence }) => {
    const row = await playerRow(ctx, roomId, playerId);
    if (!row) return null;
    await ctx.db.patch(row._id, {
      lastSeen: Date.now(),
      ...(presence ? { presence } : {}),
    });
    return null;
  },
});

/** Host starts the draft: server generates the shared seed + formation options. */
export const startDraw = mutation({
  args: { roomId: v.id("rooms"), playerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { roomId, playerId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== playerId) throw new Error("Only the host can start");
    if (room.status !== "lobby") throw new Error("Already started");
    const seated = await playersOf(ctx, roomId);
    if (seated.length < 2) throw new Error("Need two players");

    const seed = randomSeed();
    const formationOptionIds = drawFormationOptions(seed, 5).map((f) => f.id);
    const buildDeadline = Date.now() + BUILD_TIMER_MS;

    await ctx.db.patch(roomId, {
      status: "build",
      seed,
      formationOptionIds,
      buildDeadline,
    });
    for (const p of seated) {
      await ctx.db.patch(p._id, { confirmed: false, presence: "building" });
    }

    // Authority backstop: resolve at the deadline even if a player goes AFK.
    await ctx.scheduler.runAt(buildDeadline, internal.duel.finalizeDuel, {
      roomId,
    });
    return null;
  },
});

/** Submit (and confirm) a seat's build: the action log the server will replay. */
export const submitBuild = mutation({
  args: {
    roomId: v.id("rooms"),
    playerId: v.string(),
    formationId: v.string(),
    tactic: v.union(
      v.literal("offensive"),
      v.literal("balanced"),
      v.literal("defensive"),
    ),
    actionsJson: v.string(),
  },
  returns: v.null(),
  handler: async (ctx, args) => {
    const room = await ctx.db.get(args.roomId);
    if (!room || room.status !== "build") throw new Error("Not in build phase");
    const me = await playerRow(ctx, args.roomId, args.playerId);
    if (!me) throw new Error("Not in this room");

    const existing = await ctx.db
      .query("builds")
      .withIndex("by_room_player", (q) =>
        q.eq("roomId", args.roomId).eq("playerId", args.playerId),
      )
      .unique();
    const patch = {
      roomId: args.roomId,
      playerId: args.playerId,
      seat: me.seat,
      formationId: args.formationId,
      tactic: args.tactic,
      actionsJson: args.actionsJson,
      confirmedAt: Date.now(),
    };
    if (existing) await ctx.db.patch(existing._id, patch);
    else await ctx.db.insert("builds", patch);

    await ctx.db.patch(me._id, {
      confirmed: true,
      presence: "ready",
      lastSeen: Date.now(),
    });

    // Both confirmed → resolve immediately rather than waiting for the timer.
    const seated = await playersOf(ctx, args.roomId);
    if (seated.length === 2 && seated.every((p: Doc<"roomPlayers">) => p.confirmed)) {
      await ctx.scheduler.runAfter(0, internal.duel.finalizeDuel, {
        roomId: args.roomId,
      });
    }
    return null;
  },
});

/**
 * Resolve the duel once, server-authoritatively. Idempotent: guarded on room
 * status and an existing timeline. Replays each seat's action log; a missing,
 * tampered, or incomplete log falls back to a neutral auto-filled XI
 * (MVP §9.3 / §4.2 AFK handling).
 */
export const finalizeDuel = internalMutation({
  args: { roomId: v.id("rooms") },
  returns: v.null(),
  handler: async (ctx, { roomId }) => {
    const room = await ctx.db.get(roomId);
    if (!room || room.status !== "build" || !room.seed) return null;
    const already = await ctx.db
      .query("timelines")
      .withIndex("by_room", (q) => q.eq("roomId", roomId))
      .first();
    if (already) return null;

    const seed = room.seed;
    const seated = await playersOf(ctx, roomId);
    const bySeat: Record<Side, Doc<"roomPlayers"> | undefined> = {
      home: seated.find((p: Doc<"roomPlayers">) => p.seat === "home"),
      away: seated.find((p: Doc<"roomPlayers">) => p.seat === "away"),
    };

    async function resolveSide(side: Side) {
      const player = bySeat[side];
      const build = player
        ? await ctx.db
            .query("builds")
            .withIndex("by_room_player", (q) =>
              q.eq("roomId", roomId).eq("playerId", player.playerId),
            )
            .unique()
        : null;

      const formationId = build?.formationId ?? DEFAULT_FORMATION_ID;
      const tactic: Tactic = (build?.tactic as Tactic) ?? "balanced";
      let actions: BuildAction[] = [];
      if (build) {
        try {
          actions = JSON.parse(build.actionsJson) as BuildAction[];
        } catch {
          actions = [];
        }
      }

      const replay = replayAndValidate(duelCatalog, {
        seed,
        side,
        formationId,
        actions,
        tactic,
      });
      if (replay.ok) return { buildState: replay.state, tactic };

      // Missing/tampered/illegal log → discard it and auto-fill a neutral XI
      // from the empty draft (MVP §9.3 / AFK handling).
      const fallback = replayAndValidate(duelCatalog, {
        seed,
        side,
        formationId,
        actions: [],
        tactic,
      });
      if (!fallback.ok) throw new Error("could not reconstruct lineup");
      return { buildState: fallback.state, tactic };
    }

    const home = await resolveSide("home");
    const away = await resolveSide("away");

    const { result, timeline, chemistry } = resolveDuel(duelCatalog, {
      seed,
      home,
      away,
    });

    await ctx.db.insert("timelines", {
      roomId,
      seed,
      timelineJson: JSON.stringify(timeline),
    });

    const [hg, ag] = result.score;
    const winner = result.winner; // knockout → always a Side
    for (const side of ["home", "away"] as const) {
      const player = bySeat[side];
      if (!player) continue;
      const gf = side === "home" ? hg : ag;
      const ga = side === "home" ? ag : hg;
      const outcome =
        winner === "draw" ? "draw" : winner === side ? "win" : "loss";
      await ctx.db.insert("results", {
        roomId,
        playerId: player.playerId,
        seat: side,
        gf,
        ga,
        outcome,
        chemistryPct: chemistry[side],
      });
    }

    await ctx.db.patch(roomId, { status: "reveal", buildDeadline: undefined });
    return null;
  },
});

/** Start a fresh duel with the same two players (rematch resets in place). */
export const rematch = mutation({
  args: { roomId: v.id("rooms"), playerId: v.string() },
  returns: v.null(),
  handler: async (ctx, { roomId, playerId }) => {
    const room = await ctx.db.get(roomId);
    if (!room) throw new Error("Room not found");
    if (room.hostId !== playerId) throw new Error("Only the host can rematch");

    for (const table of ["builds", "timelines", "results"] as const) {
      const rows = await ctx.db
        .query(table)
        .withIndex("by_room", (q) => q.eq("roomId", roomId))
        .collect();
      for (const r of rows) await ctx.db.delete(r._id);
    }
    const seated = await playersOf(ctx, roomId);
    for (const p of seated) {
      await ctx.db.patch(p._id, { confirmed: false, presence: "connected" });
    }
    await ctx.db.patch(roomId, {
      status: "lobby",
      seed: undefined,
      formationOptionIds: undefined,
      buildDeadline: undefined,
    });
    return null;
  },
});

/** Reactive room state — the realtime spine clients subscribe to (PRD §9.5). */
export const roomState = query({
  args: { code: v.string() },
  returns: v.union(
    v.null(),
    v.object({
      roomId: v.id("rooms"),
      code: v.string(),
      status: v.string(),
      hostId: v.string(),
      seed: v.union(v.string(), v.null()),
      formationOptionIds: v.union(v.array(v.string()), v.null()),
      buildDeadline: v.union(v.number(), v.null()),
      players: v.array(
        v.object({
          playerId: v.string(),
          name: v.string(),
          seat: v.string(),
          presence: v.string(),
          confirmed: v.boolean(),
          lastSeen: v.number(),
        }),
      ),
      timeline: v.union(v.any(), v.null()),
      results: v.array(
        v.object({
          playerId: v.string(),
          seat: v.string(),
          gf: v.number(),
          ga: v.number(),
          outcome: v.string(),
          chemistryPct: v.number(),
        }),
      ),
    }),
  ),
  handler: async (ctx, { code }) => {
    const room = await ctx.db
      .query("rooms")
      .withIndex("by_code", (q) => q.eq("code", code.toUpperCase()))
      .first();
    if (!room) return null;

    const players = (await playersOf(ctx, room._id)).map((p: Doc<"roomPlayers">) => ({
      playerId: p.playerId,
      name: p.name,
      seat: p.seat,
      presence: p.presence,
      confirmed: p.confirmed,
      lastSeen: p.lastSeen,
    }));

    const timelineRow = await ctx.db
      .query("timelines")
      .withIndex("by_room", (q) => q.eq("roomId", room._id))
      .first();
    const results = (
      await ctx.db
        .query("results")
        .withIndex("by_room", (q) => q.eq("roomId", room._id))
        .collect()
    ).map((r) => ({
      playerId: r.playerId,
      seat: r.seat,
      gf: r.gf,
      ga: r.ga,
      outcome: r.outcome,
      chemistryPct: r.chemistryPct,
    }));

    return {
      roomId: room._id,
      code: room.code,
      status: room.status,
      hostId: room.hostId,
      seed: room.seed ?? null,
      formationOptionIds: room.formationOptionIds ?? null,
      buildDeadline: room.buildDeadline ?? null,
      players,
      timeline: timelineRow
        ? (JSON.parse(timelineRow.timelineJson) as unknown)
        : null,
      results,
    };
  },
});
