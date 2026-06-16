/**
 * Timeline generator — turns a decided MatchResult + seed into a serialisable,
 * ordered list of match events (PRD §7.3). The result is fixed before we start,
 * so the final `fulltime` event reconciles to the engine score by construction:
 * the count of `goal` events per side always equals the scoreline.
 *
 * Uses an RNG stream derived from `seed + ":timeline"`, independent of the
 * engine's stream, so enriching this generator never changes the score.
 */

import {
  REGULATION_MINUTES,
  STOPPAGE_ALLOWANCE,
} from "../constants.js";
import type { MatchResult } from "../engine.js";
import { pick, rngFromSeed, type Rng } from "../rng.js";
import type {
  LineupSlot,
  MatchEvent,
  MatchScenario,
  MatchTimeline,
  Side,
} from "../types.js";
import { buildBuildup, buildAttackClusters, outfield } from "./clusters.js";
import { placeGoalMinutes } from "./minutes.js";

const ATTACKER = /ST|CF|W|F|AM/;

export interface GenerateTimelineInput {
  result: MatchResult;
  seed: string;
  scenario: MatchScenario;
  lineups: Record<Side, LineupSlot[]>;
}

export function generateTimeline(input: GenerateTimelineInput): MatchTimeline {
  const { result, seed, scenario, lineups } = input;
  const rng = rngFromSeed(`${seed}:timeline`);
  const [homeGoals, awayGoals] = result.score;

  const events: MatchEvent[] = [{ t: 0, type: "kickoff", team: "home" }];

  const homeGoalEvents = buildGoals("home", homeGoals, lineups.home, rng);
  const awayGoalEvents = buildGoals("away", awayGoals, lineups.away, rng);
  events.push(...homeGoalEvents, ...awayGoalEvents);

  const reservedMinutes = new Set(
    [...homeGoalEvents, ...awayGoalEvents]
      .filter((e) => e.type === "goal")
      .map((e) => e.t),
  );

  events.push(
    ...buildAttackClusters(
      "home",
      result.lambda[0],
      lineups.home,
      rng,
      reservedMinutes,
    ),
  );
  events.push(
    ...buildAttackClusters(
      "away",
      result.lambda[1],
      lineups.away,
      rng,
      reservedMinutes,
    ),
  );

  // Stable chronological order; kickoff (t=0) stays first.
  events.sort((a, b) => a.t - b.t);

  // Final whistle reconciles to the engine score.
  const lastMinute = events.reduce((m, e) => Math.max(m, e.t), 0);
  const ftMinute = Math.max(lastMinute, REGULATION_MINUTES);
  events.push({ t: ftMinute, type: "fulltime", score: result.score });

  // Knockout shootout, if any, plays after full time.
  if (result.shootout) {
    events.push({
      t: ftMinute,
      type: "shootout",
      kicks: result.shootout.kicks,
      winner: result.shootout.winner,
    });
  }

  return {
    seed,
    scenario,
    lineups,
    result: {
      score: result.score,
      ...(result.penalties ? { penalties: result.penalties } : {}),
    },
    events,
    durationMs: computeDuration(ftMinute, Boolean(result.shootout)),
  };
}

function buildGoals(
  side: Side,
  count: number,
  lineup: LineupSlot[],
  rng: Rng,
): MatchEvent[] {
  const minutes = placeGoalMinutes(count, rng);
  const players = outfield(lineup);
  const events: MatchEvent[] = [];

  for (const t of minutes) {
    const scorer = pickScorer(lineup, rng);
    const { possession, lastBall, lastReceiverId } = buildBuildup(
      side,
      t,
      players,
      rng,
    );
    events.push(possession);
    const goal: MatchEvent = {
      t,
      type: "goal",
      team: side,
      scorerId: scorer.playerId,
      from: lastBall,
    };
    if (lastReceiverId !== scorer.playerId) {
      events.push({ ...goal, assistId: lastReceiverId });
    } else {
      events.push(goal);
    }
  }

  return events;
}

/** Prefer attackers as scorers, but anyone outfield can score. */
function pickScorer(lineup: LineupSlot[], rng: Rng): LineupSlot {
  const out = outfield(lineup);
  const attackers = out.filter((s) => ATTACKER.test(s.position.toUpperCase()));
  const pool = attackers.length > 0 && rng() < 0.7 ? attackers : out;
  return pick(rng, pool.length > 0 ? pool : lineup);
}

/** Normal-speed playback length: ~90 min → ~75 s, plus shootout time. */
function computeDuration(lastMinute: number, hasShootout: boolean): number {
  const base = Math.round(
    (lastMinute / (REGULATION_MINUTES + STOPPAGE_ALLOWANCE)) * 75_000,
  );
  return base + (hasShootout ? 12_000 : 0);
}
