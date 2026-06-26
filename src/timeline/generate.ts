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
  EXTRA_TIME_END,
  EXTRA_TIME_HALF,
  PENALTY_GOAL_CHANCE,
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
import { anyPositionRole } from "../chemistry.js";
import { buildBuildup, buildAttackClusters, outfield } from "./clusters.js";
import { buildIncidents } from "./incidents.js";
import { placeGoalMinutes } from "./minutes.js";

/** Halftime falls at the midpoint of regulation. */
const HALFTIME_MINUTE = REGULATION_MINUTES / 2; // 45
/** Extra-time goals land in 91 … 120 (+stoppage). */
const EXTRA_TIME_GOAL_LO = REGULATION_MINUTES + 1;
const EXTRA_TIME_GOAL_HI = EXTRA_TIME_END + STOPPAGE_ALLOWANCE;

/** Roles that lead the line — favoured (but not required) as goalscorers. */
const SCORING_ROLES = new Set(["ST", "W", "AM"]);

export interface GenerateTimelineInput {
  result: MatchResult;
  seed: string;
  scenario: MatchScenario;
  lineups: Record<Side, LineupSlot[]>;
}

export function generateTimeline(input: GenerateTimelineInput): MatchTimeline {
  const { result, seed, scenario, lineups } = input;
  const rng = rngFromSeed(`${seed}:timeline`);
  const [regHome, regAway] = result.regulation;
  const extraTime = Boolean(result.extraTime);

  const events: MatchEvent[] = [{ t: 0, type: "kickoff", team: "home" }];

  // Regulation goals. Their count is `result.regulation`, so the scoreline at
  // 90' reconciles by construction. When the tie goes to extra time we cap the
  // window at 90' (not the usual +stoppage) so regulation goals can't bleed into
  // the 91–120 extra-time band and the 90' scoreline reads as the drawn result.
  const regHi = extraTime ? REGULATION_MINUTES : undefined;
  const goalEvents: MatchEvent[] = [
    ...buildGoals("home", regHome, lineups.home, rng, undefined, regHi),
    ...buildGoals("away", regAway, lineups.away, rng, undefined, regHi),
  ];

  // Extra-time goals (91–120), if a knockout tie went the distance.
  if (extraTime) {
    const [finalHome, finalAway] = result.score;
    goalEvents.push(
      ...buildGoals(
        "home",
        finalHome - regHome,
        lineups.home,
        rng,
        EXTRA_TIME_GOAL_LO,
        EXTRA_TIME_GOAL_HI,
      ),
      ...buildGoals(
        "away",
        finalAway - regAway,
        lineups.away,
        rng,
        EXTRA_TIME_GOAL_LO,
        EXTRA_TIME_GOAL_HI,
      ),
    );
  }
  events.push(...goalEvents);

  const reservedMinutes = new Set(
    goalEvents.filter((e) => e.type === "goal").map((e) => e.t),
  );

  events.push(
    ...buildAttackClusters("home", result.lambda[0], lineups.home, rng, reservedMinutes),
    ...buildAttackClusters("away", result.lambda[1], lineups.away, rng, reservedMinutes),
  );

  // Cosmetic incidents (fouls, cards, subs, offsides, throw-ins) across the
  // whole playable window — ET included when it ran.
  const maxMinute = extraTime ? EXTRA_TIME_GOAL_HI : REGULATION_MINUTES + STOPPAGE_ALLOWANCE;
  events.push(...buildIncidents(lineups, rng, reservedMinutes, maxMinute));

  // Period markers the live clock reads.
  events.push({ t: HALFTIME_MINUTE, type: "halftime" });
  if (extraTime) {
    events.push(
      { t: REGULATION_MINUTES, type: "extratime", mark: "start" },
      { t: EXTRA_TIME_HALF, type: "extratime", mark: "ht" },
      { t: EXTRA_TIME_END, type: "extratime", mark: "end" },
    );
  }

  // Stable chronological order; kickoff (t=0) stays first.
  events.sort((a, b) => a.t - b.t);

  // Final whistle reconciles to the engine score.
  const lastMinute = events.reduce((m, e) => Math.max(m, e.t), 0);
  const ftFloor = extraTime ? EXTRA_TIME_END : REGULATION_MINUTES;
  const ftMinute = Math.max(lastMinute, ftFloor);
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
  lo?: number,
  hi?: number,
): MatchEvent[] {
  const minutes = placeGoalMinutes(count, rng, lo, hi);
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
    // Occasionally dramatise a goal as a penalty (cosmetic context for the
    // ticker + stats). The `goal` event is always kept, so the goal-count
    // reconciliation guarantee is untouched.
    if (rng() < PENALTY_GOAL_CHANCE) {
      events.push({ t, type: "penalty", team: side, outcome: "goal" });
    }
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
  const attackers = out.filter((s) => {
    const role = anyPositionRole(s.position);
    return role !== null && SCORING_ROLES.has(role);
  });
  const pool = attackers.length > 0 && rng() < 0.7 ? attackers : out;
  return pick(rng, pool.length > 0 ? pool : lineup);
}

/** Fast-tier playback length: ~90 min → ~75 s, plus shootout time. */
function computeDuration(lastMinute: number, hasShootout: boolean): number {
  const base = Math.round(
    (lastMinute / (REGULATION_MINUTES + STOPPAGE_ALLOWANCE)) * 75_000,
  );
  return base + (hasShootout ? 12_000 : 0);
}
