/**
 * Match "incidents" — the cosmetic non-goal chronology that makes the live
 * ticker feel like a real broadcast: fouls (sometimes a free kick and/or a
 * card), substitutions, offsides and throw-ins. Like all timeline filler these
 * are generated from the `seed:timeline` RNG stream and can NEVER change the
 * score (no `goal` events are produced here).
 */

import {
  CARD_PER_FOUL,
  FOUL_TO_FREEKICK,
  FOULS_PER_MATCH,
  OFFSIDES_PER_MATCH,
  RED_CARD_CHANCE,
  SUBS_PER_SIDE,
  THROWINS_PER_MATCH,
} from "../constants.js";
import { pick, randInt, type Rng } from "../rng.js";
import type { LineupSlot, MatchEvent, Side } from "../types.js";
import { attackSpot, outfield } from "./clusters.js";

/** A minute in [1, maxMinute] that isn't a reserved goal minute (best-effort). */
function freeMinute(
  rng: Rng,
  maxMinute: number,
  reserved: ReadonlySet<number>,
): number {
  let t = randInt(rng, 1, maxMinute);
  let guard = 0;
  while (reserved.has(t) && guard < 12) {
    t = randInt(rng, 1, maxMinute);
    guard++;
  }
  return t;
}

/** A bench shirt number (12–23) not already worn by the starting XI. */
function benchNumber(lineup: LineupSlot[], rng: Rng): number {
  const used = new Set(lineup.map((s) => s.number));
  const free: number[] = [];
  for (let n = 12; n <= 23; n++) if (!used.has(n)) free.push(n);
  return free.length > 0 ? pick(rng, free) : 12;
}

/**
 * Scatter incidents across the playable window. `maxMinute` is the last minute
 * play can reach (regulation +stoppage, or extra time +stoppage when ET ran),
 * so incidents fill the whole match, ET included.
 */
export function buildIncidents(
  lineups: Record<Side, LineupSlot[]>,
  rng: Rng,
  reservedMinutes: ReadonlySet<number>,
  maxMinute: number,
): MatchEvent[] {
  const events: MatchEvent[] = [];
  const sides: Side[] = ["home", "away"];
  const playersOf: Record<Side, LineupSlot[]> = {
    home: outfield(lineups.home),
    away: outfield(lineups.away),
  };

  // Disciplinary memory, so cards behave like a real match: a booked player who
  // fouls again is shown a second yellow and sent off, and a sent-off player is
  // no longer on the pitch (can't foul, be carded, or be substituted).
  const yellow = new Set<string>();
  const sentOff = new Set<string>();

  // Fouls — generate (minute, team) first, then resolve them in chronological
  // order so yellow accumulation reads correctly (first booking before the
  // second). Each foul may yield a quick free kick and/or a card.
  const fouls = Array.from({ length: FOULS_PER_MATCH }, () => ({
    team: (rng() < 0.5 ? "home" : "away") as Side,
    t: freeMinute(rng, maxMinute, reservedMinutes),
  })).sort((a, b) => a.t - b.t);

  for (const { team, t } of fouls) {
    const onPitch = playersOf[team].filter((p) => !sentOff.has(p.playerId));
    if (onPitch.length === 0) continue;
    const offender = pick(rng, onPitch);
    events.push({ t, type: "foul", team, byId: offender.playerId });

    if (rng() < FOUL_TO_FREEKICK) {
      const other: Side = team === "home" ? "away" : "home";
      events.push({ t, type: "freekick", team: other, from: attackSpot(rng, other) });
    }

    if (rng() < CARD_PER_FOUL) {
      const id = offender.playerId;
      if (rng() < RED_CARD_CHANCE) {
        // Straight red — off he goes.
        sentOff.add(id);
        events.push({ t, type: "card", team, playerId: id, card: "red" });
      } else if (yellow.has(id)) {
        // Second bookable → second yellow → red.
        yellow.delete(id);
        sentOff.add(id);
        events.push({ t, type: "card", team, playerId: id, card: "red", secondYellow: true });
      } else {
        yellow.add(id);
        events.push({ t, type: "card", team, playerId: id, card: "yellow" });
      }
    }
  }

  // Substitutions — each side makes a few in the back third of the match. A
  // player already sent off can't be the one coming off.
  for (const team of sides) {
    const subbable = new Set<string>();
    for (let i = 0; i < SUBS_PER_SIDE; i++) {
      const t = Math.min(maxMinute, randInt(rng, 60, 85));
      const pool = playersOf[team].filter(
        (p) => !sentOff.has(p.playerId) && !subbable.has(p.playerId),
      );
      if (pool.length === 0) continue;
      const off = pick(rng, pool);
      subbable.add(off.playerId);
      events.push({
        t,
        type: "substitution",
        team,
        outId: off.playerId,
        inNumber: benchNumber(lineups[team], rng),
      });
    }
  }

  // Offsides.
  for (let i = 0; i < OFFSIDES_PER_MATCH; i++) {
    const team = rng() < 0.5 ? "home" : "away";
    events.push({ t: freeMinute(rng, maxMinute, reservedMinutes), type: "offside", team });
  }

  // Throw-ins (sampled — a real match has dozens; we surface a readable few).
  for (let i = 0; i < THROWINS_PER_MATCH; i++) {
    const team = rng() < 0.5 ? "home" : "away";
    events.push({
      t: freeMinute(rng, maxMinute, reservedMinutes),
      type: "throwin",
      team,
      side: rng() < 0.5 ? "L" : "R",
    });
  }

  return events;
}
