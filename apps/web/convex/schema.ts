import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Online 1v1 Duel (MVP M4 / PRD §9). Server-authoritative: the server owns the
 * seed, the shared formation options, validation (via action-log replay) and
 * the canonical timeline. Clients only present what they read back.
 *
 * State machine (room.status): lobby → build → reveal → result.
 */

const seat = v.union(v.literal("home"), v.literal("away"));
const presence = v.union(
  v.literal("connected"),
  v.literal("building"),
  v.literal("ready"),
  v.literal("disconnected"),
);
const status = v.union(
  v.literal("lobby"),
  v.literal("build"),
  v.literal("reveal"),
  v.literal("result"),
);
const tactic = v.union(
  v.literal("offensive"),
  v.literal("balanced"),
  v.literal("defensive"),
);
const outcome = v.union(
  v.literal("win"),
  v.literal("loss"),
  v.literal("draw"),
);

export default defineSchema({
  rooms: defineTable({
    code: v.string(),
    status,
    hostId: v.string(),
    // Server-owned, set at startDraw. Drives the shared deterministic draft.
    seed: v.optional(v.string()),
    formationOptionIds: v.optional(v.array(v.string())),
    buildDeadline: v.optional(v.number()), // ms epoch
    createdAt: v.number(),
  }).index("by_code", ["code"]),

  roomPlayers: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    name: v.string(),
    seat,
    presence,
    confirmed: v.boolean(),
    lastSeen: v.number(),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"]),

  // One row per seat: the client-submitted action log the server replays.
  builds: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    seat,
    formationId: v.string(),
    tactic,
    actionsJson: v.string(), // JSON-encoded BuildAction[]
    confirmedAt: v.optional(v.number()),
  })
    .index("by_room", ["roomId"])
    .index("by_room_player", ["roomId", "playerId"]),

  // Canonical, immutable result computed once by finalizeDuel.
  timelines: defineTable({
    roomId: v.id("rooms"),
    seed: v.string(),
    timelineJson: v.string(), // JSON-encoded MatchTimeline
  }).index("by_room", ["roomId"]),

  results: defineTable({
    roomId: v.id("rooms"),
    playerId: v.string(),
    seat,
    gf: v.number(),
    ga: v.number(),
    outcome,
    chemistryPct: v.number(),
  }).index("by_room", ["roomId"]),
});
