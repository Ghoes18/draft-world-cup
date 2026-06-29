import { v } from "convex/values";
import { query } from "./_generated/server";
import { DEFAULT_ELO } from "7a0-engine/dist";

const ratingRow = {
  playerId: v.string(),
  name: v.string(),
  elo: v.number(),
  peakElo: v.number(),
  wins: v.number(),
  draws: v.number(),
  losses: v.number(),
  played: v.number(),
  tournaments: v.number(),
  titles: v.number(),
};

/** Top players by Elo, for the /leaderboard page. */
export const leaderboard = query({
  args: { limit: v.optional(v.number()) },
  returns: v.array(v.object({ rank: v.number(), ...ratingRow })),
  handler: async (ctx, { limit }) => {
    const rows = await ctx.db
      .query("ratings")
      .withIndex("by_elo")
      .order("desc")
      .take(Math.min(limit ?? 50, 100));
    return rows.map((r, i) => ({
      rank: i + 1,
      playerId: r.playerId,
      name: r.name,
      elo: r.elo,
      peakElo: r.peakElo,
      wins: r.wins,
      draws: r.draws,
      losses: r.losses,
      played: r.played,
      tournaments: r.tournaments,
      titles: r.titles,
    }));
  },
});

/**
 * A player's own rating, plus the change from their most recent tournament so
 * the reveal screen can show a "+18" / "-12" delta scoped to that tournament.
 * Returns a synthetic default for a player who has not been rated yet.
 */
export const myRating = query({
  args: { playerId: v.string() },
  returns: v.object({
    rated: v.boolean(),
    ...ratingRow,
    lastDelta: v.optional(v.number()),
    lastTournamentId: v.optional(v.id("tournaments")),
  }),
  handler: async (ctx, { playerId }) => {
    const row = await ctx.db
      .query("ratings")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .unique();
    if (!row) {
      return {
        rated: false,
        playerId,
        name: "",
        elo: DEFAULT_ELO,
        peakElo: DEFAULT_ELO,
        wins: 0,
        draws: 0,
        losses: 0,
        played: 0,
        tournaments: 0,
        titles: 0,
      };
    }
    return {
      rated: true,
      playerId: row.playerId,
      name: row.name,
      elo: row.elo,
      peakElo: row.peakElo,
      wins: row.wins,
      draws: row.draws,
      losses: row.losses,
      played: row.played,
      tournaments: row.tournaments,
      titles: row.titles,
      lastDelta: row.lastDelta,
      lastTournamentId: row.lastTournamentId,
    };
  },
});

const placement = v.union(
  v.literal("champion"),
  v.literal("finalist"),
  v.literal("semifinalist"),
  v.literal("group"),
);

/** A player's recent online tournament results, newest first. */
export const myHistory = query({
  args: { playerId: v.string(), limit: v.optional(v.number()) },
  returns: v.array(
    v.object({
      tournamentId: v.id("tournaments"),
      createdAt: v.number(),
      placement,
      slot: v.number(),
    }),
  ),
  handler: async (ctx, { playerId, limit }) => {
    const seats = await ctx.db
      .query("participants")
      .withIndex("by_player", (q) => q.eq("playerId", playerId))
      .order("desc")
      .take(Math.min(limit ?? 10, 25));

    const out = [];
    for (const seat of seats) {
      const tournament = await ctx.db.get(seat.tournamentId);
      if (!tournament) continue;
      const matches = await ctx.db
        .query("matches")
        .withIndex("by_tournament", (q) => q.eq("tournamentId", seat.tournamentId))
        .collect();

      let place: "champion" | "finalist" | "semifinalist" | "group";
      if (tournament.championSlot === seat.slot) {
        place = "champion";
      } else if (
        matches.some(
          (m) =>
            m.stage === "final" &&
            (m.homeSlot === seat.slot || m.awaySlot === seat.slot),
        )
      ) {
        place = "finalist";
      } else if (
        matches.some(
          (m) =>
            m.stage === "semi" &&
            (m.homeSlot === seat.slot || m.awaySlot === seat.slot),
        )
      ) {
        place = "semifinalist";
      } else {
        place = "group";
      }

      out.push({
        tournamentId: seat.tournamentId,
        createdAt: tournament.createdAt,
        placement: place,
        slot: seat.slot,
      });
    }
    return out;
  },
});
