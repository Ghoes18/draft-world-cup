/**
 * Stats consumer (MVP M3): turns a MatchTimeline into a side-by-side statistics
 * breakdown — possession %, shots, shots on target, corners, penalties, passes,
 * and an approximate xG (MVP §4.4 / GAME-GUIDE §10).
 *
 * Like `toFastText`, this is a pure consumer of the *same* timeline: one
 * timeline in, derived numbers out, no coupling to the engine. That keeps it
 * valid for shared highlights and server-persisted online/daily timelines.
 */

import {
  XG_GOAL,
  XG_OFF,
  XG_ON_TARGET,
  XG_PENALTY,
  XG_POST,
} from "../constants.js";
import type { MatchEvent, MatchTimeline, Side } from "../types.js";

export interface TeamStats {
  /** Integer percentage; `home + away === 100`. */
  possession: number;
  shots: number;
  shotsOnTarget: number;
  corners: number;
  penalties: number;
  passes: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  /** Approximate expected goals, one decimal. */
  xg: number;
}

export interface MatchStats {
  home: TeamStats;
  away: TeamStats;
}

interface Acc {
  shots: number;
  shotsOnTarget: number;
  corners: number;
  penalties: number;
  passes: number;
  fouls: number;
  yellowCards: number;
  redCards: number;
  offsides: number;
  xg: number;
}

function emptyAcc(): Acc {
  return {
    shots: 0,
    shotsOnTarget: 0,
    corners: 0,
    penalties: 0,
    passes: 0,
    fouls: 0,
    yellowCards: 0,
    redCards: 0,
    offsides: 0,
    xg: 0,
  };
}

export function computeMatchStats(timeline: MatchTimeline): MatchStats {
  const acc: Record<Side, Acc> = { home: emptyAcc(), away: emptyAcc() };

  for (const e of timeline.events) {
    tally(acc, e);
  }

  const totalPasses = acc.home.passes + acc.away.passes;
  const homePossession =
    totalPasses === 0 ? 50 : Math.round((acc.home.passes / totalPasses) * 100);

  return {
    home: finalize(acc.home, homePossession),
    away: finalize(acc.away, 100 - homePossession),
  };
}

function tally(acc: Record<Side, Acc>, e: MatchEvent): void {
  switch (e.type) {
    case "goal":
      // Every goal is a shot on target that scored.
      acc[e.team].shots++;
      acc[e.team].shotsOnTarget++;
      acc[e.team].xg += XG_GOAL;
      break;
    case "shot":
      acc[e.team].shots++;
      if (e.outcome === "saved") acc[e.team].shotsOnTarget++;
      acc[e.team].xg += shotXg(e.outcome);
      break;
    case "corner":
      acc[e.team].corners++;
      break;
    case "penalty":
      acc[e.team].penalties++;
      // A penalty that scored is already counted via its `goal` event; only a
      // non-goal penalty attempt adds an extra shot + xG (no double count).
      if (e.outcome !== "goal") {
        acc[e.team].shots++;
        if (e.outcome === "saved") acc[e.team].shotsOnTarget++;
        acc[e.team].xg += XG_PENALTY;
      }
      break;
    case "possession":
      acc[e.team].passes += e.passes.length;
      break;
    case "foul":
      acc[e.team].fouls++;
      break;
    case "card":
      if (e.card === "red") acc[e.team].redCards++;
      else acc[e.team].yellowCards++;
      break;
    case "offside":
      acc[e.team].offsides++;
      break;
    // kickoff, freekick, throwin, substitution, halftime, extratime,
    // fulltime, shootout carry no statistics.
  }
}

function shotXg(outcome: "saved" | "off" | "post" | "goal"): number {
  switch (outcome) {
    case "goal":
      return XG_GOAL;
    case "saved":
      return XG_ON_TARGET;
    case "post":
      return XG_POST;
    case "off":
      return XG_OFF;
  }
}

function finalize(acc: Acc, possession: number): TeamStats {
  return {
    possession,
    shots: acc.shots,
    shotsOnTarget: acc.shotsOnTarget,
    corners: acc.corners,
    penalties: acc.penalties,
    passes: acc.passes,
    fouls: acc.fouls,
    yellowCards: acc.yellowCards,
    redCards: acc.redCards,
    offsides: acc.offsides,
    xg: Math.round(acc.xg * 10) / 10,
  };
}
