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
  Vec2,
} from "../types.js";
import { buildFiller } from "./filler.js";
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

  // Known goals — emitted as `goal` events so the timeline reconciles exactly.
  events.push(...buildGoals("home", homeGoals, lineups.home, rng));
  events.push(...buildGoals("away", awayGoals, lineups.away, rng));

  // Cosmetic filler whose density tracks each side's λ. Never affects score.
  events.push(...buildFiller("home", result.lambda[0], lineups.home, rng));
  events.push(...buildFiller("away", result.lambda[1], lineups.away, rng));

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
  return minutes.map((t) => ({
    t,
    type: "goal" as const,
    team: side,
    scorerId: pickScorer(lineup, rng).playerId,
    from: goalSpot(rng, side),
  }));
}

/** Prefer attackers as scorers, but anyone outfield can score. */
function pickScorer(lineup: LineupSlot[], rng: Rng): LineupSlot {
  const outfield = lineup.filter((s) => s.position.toUpperCase() !== "GK");
  const attackers = outfield.filter((s) => ATTACKER.test(s.position.toUpperCase()));
  const pool = attackers.length > 0 && rng() < 0.7 ? attackers : outfield;
  return pick(rng, pool.length > 0 ? pool : lineup);
}

function goalSpot(rng: Rng, side: Side): Vec2 {
  const depth = 0.75 + rng() * 0.2; // close to the opponent goal
  const x = side === "home" ? depth : 1 - depth;
  return { x, y: 0.3 + rng() * 0.4 };
}

/** Normal-speed playback length: ~90 min → ~75 s, plus shootout time. */
function computeDuration(lastMinute: number, hasShootout: boolean): number {
  const base = Math.round(
    (lastMinute / (REGULATION_MINUTES + STOPPAGE_ALLOWANCE)) * 75_000,
  );
  return base + (hasShootout ? 12_000 : 0);
}
