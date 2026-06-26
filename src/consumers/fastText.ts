/**
 * Fast-tier consumer: turns a MatchTimeline into a minute-by-minute text
 * ticker. This is M1's verification path and, in the product, the screen-reader
 * / accessibility tier (MVP §4.1) — it must be fully usable without a canvas.
 *
 * Possession chains are omitted by default (cosmetic timeline filler);
 * Fast surfaces the *key* events.
 */

import type {
  LineupSlot,
  MatchEvent,
  MatchTimeline,
  Side,
} from "../types.js";

export interface FastTextOptions {
  /** Display labels per side; defaults to "Home" / "Away". */
  labels?: Record<Side, string>;
  /** Include possession chains as lines (default false — noisy). */
  includePossession?: boolean;
}

export function toFastText(
  timeline: MatchTimeline,
  options: FastTextOptions = {},
): string[] {
  const labels = options.labels ?? { home: "Home", away: "Away" };
  const numberOf = buildNumberLookup(timeline.lineups);
  const lines: string[] = [];
  const running: [number, number] = [0, 0];
  // The 91–120 minute band is shared by regulation stoppage and extra time;
  // the `extratime` start marker disambiguates the clock for later events.
  let inExtraTime = false;

  for (const e of timeline.events) {
    if (e.type === "extratime" && e.mark === "start") inExtraTime = true;
    if (e.type === "shootout") {
      lines.push(...formatShootout(e, labels));
      continue;
    }
    const line = formatEvent(e, labels, numberOf, running, options, inExtraTime);
    if (line !== null) lines.push(line);
  }
  return lines;
}

function formatEvent(
  e: MatchEvent,
  labels: Record<Side, string>,
  numberOf: Map<string, number>,
  running: [number, number],
  options: FastTextOptions,
  inExtraTime: boolean,
): string | null {
  const who = (id: string): string => {
    const shirt = numberOf.get(id);
    return shirt != null ? `#${shirt}` : id;
  };
  switch (e.type) {
    case "kickoff":
      return `${clock(e.t, inExtraTime)}  Kick-off`;
    case "goal": {
      if (e.team === "home") running[0]++;
      else running[1]++;
      return `${clock(e.t, inExtraTime)}  GOAL! ${labels[e.team]} (${who(e.scorerId)})  —  ${running[0]}–${running[1]}`;
    }
    case "shot":
      return `${clock(e.t, inExtraTime)}  Shot ${labels[e.team]} (${e.outcome})`;
    case "corner":
      return `${clock(e.t, inExtraTime)}  Corner ${labels[e.team]} (${e.side})`;
    case "freekick":
      return `${clock(e.t, inExtraTime)}  Free kick ${labels[e.team]}`;
    case "penalty":
      return `${clock(e.t, inExtraTime)}  Penalty ${labels[e.team]} — ${e.outcome}`;
    case "foul":
      return `${clock(e.t, inExtraTime)}  Foul ${labels[e.team]} (${who(e.byId)})`;
    case "card":
      return `${clock(e.t, inExtraTime)}  ${e.card === "red" ? "Red" : "Yellow"} card ${labels[e.team]} (${who(e.playerId)})`;
    case "substitution":
      return `${clock(e.t, inExtraTime)}  Sub ${labels[e.team]}: ${who(e.outId)} off, #${e.inNumber} on`;
    case "offside":
      return `${clock(e.t, inExtraTime)}  Offside ${labels[e.team]}`;
    case "throwin":
      return `${clock(e.t, inExtraTime)}  Throw-in ${labels[e.team]} (${e.side})`;
    case "halftime":
      return `HT  Half-time`;
    case "extratime": {
      if (e.mark === "start") return `${clock(e.t, true)}  Extra time`;
      if (e.mark === "ht") return `${clock(e.t, true)}  Extra time — half-time`;
      return `${clock(e.t, true)}  End of extra time`;
    }
    case "possession":
      return options.includePossession
        ? `${clock(e.t, inExtraTime)}  ${labels[e.team]} keep the ball (${e.passes.length} passes)`
        : null;
    case "fulltime":
      return `FT  ${labels.home} ${e.score[0]}–${e.score[1]} ${labels.away}`;
    case "shootout":
      return null; // handled by formatShootout in toFastText
  }
}

/** One line per kick, then the result, so the shootout reads dramatically. */
function formatShootout(
  e: { kicks: { team: Side; scored: boolean }[]; winner: Side },
  labels: Record<Side, string>,
): string[] {
  const lines = [`Penalty shootout`];
  const tally: [number, number] = [0, 0];
  let round = 0;
  e.kicks.forEach((k, i) => {
    if (i % 2 === 0) round++;
    if (k.scored) tally[k.team === "home" ? 0 : 1]++;
    const mark = k.scored ? "scored" : "missed";
    lines.push(
      `  ${round}. ${labels[k.team]} — ${mark}  (${tally[0]}–${tally[1]})`,
    );
  });
  lines.push(`Penalties: ${labels.home} ${tally[0]}–${tally[1]} ${labels.away} — ${labels[e.winner]} win`);
  return lines;
}

/**
 * Clock label. In regulation, minutes past 90 read "90+n". Once extra time has
 * started, 91–120 read as plain minutes and 121+ read "120+n".
 */
function clock(t: number, inExtraTime: boolean): string {
  if (inExtraTime) return t > 120 ? `120+${t - 120}'` : `${t}'`;
  return t > 90 ? `90+${t - 90}'` : `${t}'`;
}

function buildNumberLookup(
  lineups: Record<Side, LineupSlot[]>,
): Map<string, number> {
  const map = new Map<string, number>();
  for (const side of ["home", "away"] as const) {
    for (const slot of lineups[side]) map.set(slot.playerId, slot.number);
  }
  return map;
}
