/**
 * The match engine — pure, deterministic, server-runnable.
 *
 * Decides the *numbers* only (final score, and a penalty shootout for knockout
 * draws). No rendering, no live simulation. The timeline is generated FROM this
 * result, so presentation can never disagree with the engine (CLAUDE.md).
 *
 * Determinism note: the engine derives its RNG stream from `seed + ":engine"`,
 * independent of the timeline's stream. Enriching the timeline generator
 * therefore never perturbs the decided score.
 */

import {
  BASE_LAMBDA,
  CAMPAIGN_OPPONENT_OVERALL,
  KNOCKOUT_PHASES,
  LAMBDA_SLOPE,
  MAX_LAMBDA,
  MIN_LAMBDA,
  PENALTY_BASE,
  PENALTY_MAX,
  PENALTY_MIN,
  PENALTY_SLOPE,
  type CampaignPhase,
} from "./constants.js";
import { poissonKnuth } from "./poisson.js";
import { randInt, rngFromSeed, type Rng } from "./rng.js";
import type { ShootoutKick, Side } from "./types.js";

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Effective ratings after chemistry + tactics (see `effectiveStrength`, src/strength.ts). */
export interface TeamStrength {
  attack: number;
  defense: number;
  overall: number;
}

export interface SimulateMatchInput {
  home: TeamStrength;
  away: TeamStrength;
  seed: string;
  /** Knockout matches resolve draws via the penalty model. */
  knockout?: boolean;
}

export interface Shootout {
  kicks: ShootoutKick[];
  tally: [number, number];
  winner: Side;
}

export interface MatchResult {
  score: [number, number];
  /** Expected goals used for each side, post-clamp (also feeds filler density). */
  lambda: [number, number];
  knockout: boolean;
  /** 'draw' only ever appears for non-knockout matches. */
  winner: Side | "draw";
  /** Present iff a knockout draw went to penalties. */
  shootout?: Shootout;
  /** Shootout tally, mirrored into the timeline schema's `penalties`. */
  penalties?: [number, number];
}

/** Expected goals for a team: clamp(1.4 + (attack − opponentDefense) × 0.08, 0.15, 5). */
export function expectedGoals(attack: number, opponentDefense: number): number {
  return clamp(
    BASE_LAMBDA + (attack - opponentDefense) * LAMBDA_SLOPE,
    MIN_LAMBDA,
    MAX_LAMBDA,
  );
}

/** Shootout win probability for the stronger side: clamp(0.5 + Δ × 0.012, 0.1, 0.9). */
export function penaltyWin(deltaStrength: number): number {
  return clamp(
    PENALTY_BASE + deltaStrength * PENALTY_SLOPE,
    PENALTY_MIN,
    PENALTY_MAX,
  );
}

/** Opponent overall rating for a solo-campaign phase. */
export function campaignOpponentOverall(phase: CampaignPhase): number {
  return CAMPAIGN_OPPONENT_OVERALL[phase];
}

export function isKnockoutPhase(phase: CampaignPhase): boolean {
  return KNOCKOUT_PHASES.has(phase);
}

/**
 * Resolve a knockout draw. The winner is authoritative — a single Bernoulli on
 * the penalty model (`home` wins with probability `penaltyWin(home − away)`).
 * The kick-by-kick tally is cosmetic dramatisation consistent with that winner
 * (5 kicks per side, winner strictly ahead); tunable later without affecting
 * who advances.
 */
export function simulateShootout(
  home: TeamStrength,
  away: TeamStrength,
  rng: Rng,
): Shootout {
  const pHome = penaltyWin(home.overall - away.overall);
  const winner: Side = rng() < pHome ? "home" : "away";

  const winnerMakes = randInt(rng, 3, 5);
  const loserMakes = randInt(rng, Math.max(0, winnerMakes - 3), winnerMakes - 1);
  const homeMakes = winner === "home" ? winnerMakes : loserMakes;
  const awayMakes = winner === "home" ? loserMakes : winnerMakes;

  const kicks: ShootoutKick[] = [];
  let homeLeft = homeMakes;
  let awayLeft = awayMakes;
  for (let round = 0; round < 5; round++) {
    // Home kicks first each round.
    kicks.push({ team: "home", scored: takeMake(rng, round, homeLeft) });
    if (kicks[kicks.length - 1]!.scored) homeLeft--;
    kicks.push({ team: "away", scored: takeMake(rng, round, awayLeft) });
    if (kicks[kicks.length - 1]!.scored) awayLeft--;
  }

  return { kicks, tally: [homeMakes, awayMakes], winner };
}

/** Spread a side's remaining makes across its remaining kicks (cosmetic). */
function takeMake(rng: Rng, round: number, makesLeft: number): boolean {
  const kicksLeft = 5 - round;
  if (makesLeft <= 0) return false;
  if (makesLeft >= kicksLeft) return true;
  return rng() < makesLeft / kicksLeft;
}

/**
 * Decide a match. Both sides draw goals from Poisson(λ); a knockout draw is
 * resolved by `simulateShootout`. Pure and deterministic in `seed`.
 */
export function simulateMatch(input: SimulateMatchInput): MatchResult {
  const { home, away, seed, knockout = false } = input;
  const rng = rngFromSeed(`${seed}:engine`);

  const lambdaHome = expectedGoals(home.attack, away.defense);
  const lambdaAway = expectedGoals(away.attack, home.defense);

  const homeGoals = poissonKnuth(lambdaHome, rng);
  const awayGoals = poissonKnuth(lambdaAway, rng);

  const result: MatchResult = {
    score: [homeGoals, awayGoals],
    lambda: [lambdaHome, lambdaAway],
    knockout,
    winner:
      homeGoals > awayGoals ? "home" : awayGoals > homeGoals ? "away" : "draw",
  };

  if (knockout && homeGoals === awayGoals) {
    const shootout = simulateShootout(home, away, rng);
    result.shootout = shootout;
    result.penalties = shootout.tally;
    result.winner = shootout.winner;
  }

  return result;
}
