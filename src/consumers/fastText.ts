/**
 * Fast-tier consumer: turns a MatchTimeline into a minute-by-minute text
 * ticker. This is M1's verification path and, in the product, the screen-reader
 * / accessibility tier (MVP §4.1) — it must be fully usable without a canvas.
 *
 * Possession chains are omitted by default (cosmetic detail for the 2D view);
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

  for (const e of timeline.events) {
    const line = formatEvent(e, labels, numberOf, running, options);
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
): string | null {
  switch (e.type) {
    case "kickoff":
      return `${clock(e.t)}  Kick-off`;
    case "goal": {
      if (e.team === "home") running[0]++;
      else running[1]++;
      const shirt = numberOf.get(e.scorerId);
      const who = shirt != null ? `#${shirt}` : e.scorerId;
      return `${clock(e.t)}  GOAL! ${labels[e.team]} (${who})  —  ${running[0]}–${running[1]}`;
    }
    case "shot":
      return `${clock(e.t)}  Shot ${labels[e.team]} (${e.outcome})`;
    case "corner":
      return `${clock(e.t)}  Corner ${labels[e.team]} (${e.side})`;
    case "freekick":
      return `${clock(e.t)}  Free kick ${labels[e.team]}`;
    case "penalty":
      return `${clock(e.t)}  Penalty ${labels[e.team]} — ${e.outcome}`;
    case "possession":
      return options.includePossession
        ? `${clock(e.t)}  ${labels[e.team]} keep the ball (${e.passes.length} passes)`
        : null;
    case "fulltime":
      return `FT  ${labels.home} ${e.score[0]}–${e.score[1]} ${labels.away}`;
    case "shootout": {
      const tally = shootoutTally(e.kicks);
      return `Penalties: ${labels.home} ${tally[0]}–${tally[1]} ${labels.away} — ${labels[e.winner]} win`;
    }
  }
}

/** "45'" or "90+3'" for stoppage minutes. */
function clock(t: number): string {
  return t > 90 ? `90+${t - 90}'` : `${t}'`;
}

function shootoutTally(
  kicks: { team: Side; scored: boolean }[],
): [number, number] {
  let home = 0;
  let away = 0;
  for (const k of kicks) {
    if (!k.scored) continue;
    if (k.team === "home") home++;
    else away++;
  }
  return [home, away];
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
