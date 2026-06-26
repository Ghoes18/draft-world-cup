import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

/**
 * Online World Cup tournament (MVP M4 / PRD §9, redesigned). Each player
 * drafts solo and untimed (identical UX to solo Build), then joins a pool.
 * The moment the pool reaches 8 players (or a stalled pool times out and is
 * topped up with CPU bots drafted from real historical squads), the server
 * resolves the *entire* tournament in one mutation: 2 round-robin groups of
 * 4, then semifinals, then a final — no live timers, no per-match presence.
 *
 * Server-authoritative: the server owns every match seed, validates each
 * human player's submitted action log via replay, and computes every
 * canonical timeline. Clients only present what they read back.
 */

const tactic = v.union(
  v.literal("offensive"),
  v.literal("balanced"),
  v.literal("defensive"),
);
const stage = v.union(
  v.literal("group"),
  v.literal("semi"),
  v.literal("final"),
);
const participantKind = v.union(v.literal("human"), v.literal("cpu"));

export default defineSchema({
  // One row per player currently waiting for a tournament pool to fill.
  // `tournamentId` is patched in place once the pool resolves; the client
  // clears the row (via `leaveQueue`) after it has read the tournament.
  queue: defineTable({
    playerId: v.string(),
    name: v.string(),
    // The player's own build seed (local, client-generated) — independent
    // of any match seed assigned during tournament resolution.
    seed: v.string(),
    formationId: v.string(),
    tactic,
    actionsJson: v.string(), // JSON-encoded BuildAction[]
    joinedAt: v.number(),
    lastSeen: v.number(), // heartbeat while waiting; drives staleness + bot-fill timeout
    tournamentId: v.optional(v.id("tournaments")),
  })
    .index("by_player", ["playerId"])
    .index("by_joinedAt", ["joinedAt"]),

  // One row per resolved 8-player tournament.
  tournaments: defineTable({
    seed: v.string(),
    createdAt: v.number(),
    championSlot: v.number(), // 0-7, index into participants' `slot`
  }),

  // 8 rows per tournament — one per seat, human or CPU bot.
  participants: defineTable({
    tournamentId: v.id("tournaments"),
    slot: v.number(), // 0-7
    groupIndex: v.number(), // 0 or 1 (slots 0-3 / 4-7)
    kind: participantKind,
    playerId: v.optional(v.string()), // human only
    name: v.string(), // player name, or e.g. "Portugal '06" for bots
    scenarioId: v.optional(v.string()), // cpu only, for display/flavor
  })
    .index("by_tournament", ["tournamentId"])
    .index("by_player", ["playerId"]),

  // 15 rows per tournament: 12 group + 2 semis + 1 final. The timeline is
  // stored inline (1:1 with a fixture) — no separate join table needed.
  matches: defineTable({
    tournamentId: v.id("tournaments"),
    stage,
    groupIndex: v.optional(v.number()), // group stage only
    homeSlot: v.number(),
    awaySlot: v.number(),
    seed: v.string(),
    timelineJson: v.string(), // JSON-encoded MatchTimeline
    gf: v.number(), // home perspective
    ga: v.number(),
    winnerSlot: v.optional(v.number()), // unset only for a group-stage draw
    createdAt: v.number(),
  }).index("by_tournament", ["tournamentId"]),

  // --- M6: Missions & Weekly Boss (server-authoritative, per playerId) ---

  // One row per player's daily Boss attempt (1/day). The Boss squad is fixed
  // for the ISO week (`weekKey`); `dateKey` enforces the one-try-per-day rule.
  bossAttempts: defineTable({
    playerId: v.string(),
    weekKey: v.string(), // ISO week, e.g. "2026-W26"
    dateKey: v.string(), // UTC date, e.g. "2026-06-26"
    seed: v.string(), // the fixture seed actually used
    formationId: v.string(),
    tactic,
    actionsJson: v.string(), // JSON-encoded BuildAction[]
    timelineJson: v.string(), // JSON-encoded MatchTimeline
    gf: v.number(), // player (home) perspective
    ga: v.number(),
    beat: v.boolean(), // did the player win
    createdAt: v.number(),
  })
    .index("by_player_date", ["playerId", "dateKey"]) // 1/day guard
    .index("by_week", ["weekKey"]) // weekly leaderboard
    .index("by_player_week", ["playerId", "weekKey"]), // my best this week

  // One row per (player, mission, period). `periodKey` is the UTC date for
  // daily missions and "all" for persistent ones, so a daily mission resets
  // each day while a career mission keeps a single lifetime row. Once a row is
  // completed it is never downgraded.
  missionProgress: defineTable({
    playerId: v.string(),
    missionId: v.string(),
    periodKey: v.string(),
    type: v.union(v.literal("daily"), v.literal("persistent")),
    progress: v.number(),
    target: v.number(),
    status: v.union(v.literal("in_progress"), v.literal("completed")),
    completedAt: v.optional(v.number()),
    updatedAt: v.number(),
  })
    .index("by_player", ["playerId"])
    .index("by_player_mission_period", ["playerId", "missionId", "periodKey"]),

  // One row per player: the running cumulative facts that feed career missions.
  playerStats: defineTable({
    playerId: v.string(),
    totalGoals: v.number(),
    wins: v.number(),
    cleanSheets: v.number(),
    legendIds: v.array(v.string()), // distinct legend ids ever fielded
    nations: v.array(v.string()), // distinct nations ever fielded
    updatedAt: v.number(),
  }).index("by_player", ["playerId"]),
});
