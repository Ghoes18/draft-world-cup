/**
 * FIFA-style overall (0–100) from World Cup career signals in Fjelstul data.
 *
 * Two-layer model (EA Sports FC / community-documented, see e.g.
 * https://www.reddit.com/r/EASportsFC/comments/a1wm7s/):
 *   1. Base OVR from weighted tournament + career WC merit (our autoral proxy
 *      for the 35-attribute positional score we do not have in Fjelstul).
 *   2. International reputation (1–5★) adds +0…+3 on top, with pedigree floors
 *      so iconic squad players are not crushed by one bad World Cup edition.
 *
 * Curated overlays (Pelé 99, Maradona 96) still win on conflicts.
 */

export interface CareerOverallInput {
  starts: number;
  subs: number;
  goals: number;
  knockoutGoals: number;
  finalGoals: number;
  /** Player's team won this World Cup. */
  teamWonCup: boolean;
  /** Player's team reached the final (includes winners). */
  teamReachedFinal: boolean;
  /** Distinct men's World Cups this player_id appeared in (up to scenario year). */
  worldCupsPlayed: number;
}

/** Career signals used to infer FIFA-style international reputation stars. */
export interface CareerPedigreeInput {
  worldCupsPlayed: number;
  careerStarts: number;
  careerGoals: number;
  careerKnockoutGoals: number;
  everWonCup: boolean;
  everReachedFinal: boolean;
  everReachedSemiOrBetter: boolean;
  /** Starts in the scenario's tournament edition. */
  editionStarts: number;
  /** Coarse listed position from squad row (GK/DF/MF/FW). */
  coarsePosition: string;
  shirtNumber?: number;
}

export type InternationalReputation = 1 | 2 | 3 | 4 | 5;

const OVR_FLOOR = 62;
/**
 * Heuristic ceiling for the very best World Cup careers in Fjelstul data.
 * Kept below curated overlays (e.g. Maradona 96, Pelé 1970 99).
 */
const OVR_CEILING = 93;
/**
 * Saturation constant for the absolute merit→overall curve.
 * overall = FLOOR + (CEILING - FLOOR) * merit / (merit + MERIT_HALF).
 * Tuned so group-stage regulars land ~72–74 and WC legends approach 88–93.
 */
const MERIT_HALF = 22;
const BENCH_BASE = 62;
const BENCH_SPREAD = 5;

const ICONIC_SHIRTS_ATTACK = new Set([7, 9, 10]);

function clamp(v: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, v));
}

/** Absolute (squad-independent) overall from a raw career merit score. */
function meritToOverallAbsolute(merit: number): number {
  if (merit <= 0) return BENCH_BASE;
  const t = merit / (merit + MERIT_HALF);
  return clamp(Math.round(OVR_FLOOR + t * (OVR_CEILING - OVR_FLOOR)), 0, 100);
}

/** Raw career merit for one player in one tournament (or aggregated career). */
export function careerMeritScore(input: CareerOverallInput): number {
  const {
    starts,
    subs,
    goals,
    knockoutGoals,
    finalGoals,
    teamWonCup,
    teamReachedFinal,
    worldCupsPlayed,
  } = input;

  let score = starts * 4 + subs * 1 + goals * 8;
  score += knockoutGoals * 6 + finalGoals * 10;

  if (teamWonCup) score += 28;
  else if (teamReachedFinal) score += 14;

  if (worldCupsPlayed >= 4) score += 10;
  else if (worldCupsPlayed >= 3) score += 6;
  else if (worldCupsPlayed >= 2) score += 3;

  return score;
}

/**
 * FIFA / EA international-reputation boost from community-documented tables.
 * Applied after the base OVR is rounded.
 */
export function internationalReputationBoost(
  baseOverall: number,
  stars: InternationalReputation,
): number {
  if (stars <= 2) return 0;
  if (stars === 3) return baseOverall >= 51 ? 1 : 0;
  if (stars === 4) {
    if (baseOverall >= 67) return 2;
    if (baseOverall >= 36) return 1;
    return 0;
  }
  // 5★
  if (baseOverall >= 75) return 3;
  if (baseOverall >= 50) return 2;
  if (baseOverall >= 24) return 1;
  return 0;
}

/** Minimum OVR for high-reputation players (WC pedigree, not club Ballon d'Or). */
export function reputationPedigreeFloor(stars: InternationalReputation): number {
  switch (stars) {
    case 5:
      return 85;
    case 4:
      return 78;
    case 3:
      return 72;
    default:
      return OVR_FLOOR;
  }
}

function isAttackCoarsePosition(code: string): boolean {
  const p = code.trim().toUpperCase();
  return p === "MF" || p === "FW";
}

/**
 * Infer 1–5★ international reputation from World Cup career data only.
 * Club-era fame (e.g. Ballon d'Or 2000) is approximated via iconic-shirt +
 * full group-stage run for attacking players.
 */
export function inferInternationalReputation(
  input: CareerPedigreeInput,
): InternationalReputation {
  let stars: InternationalReputation = 1;

  if (input.careerStarts > 0 || input.careerGoals > 0) stars = 2;

  if (
    input.worldCupsPlayed >= 2 ||
    input.careerGoals >= 2 ||
    input.careerStarts >= 6
  ) {
    stars = 3;
  }

  if (
    input.worldCupsPlayed >= 3 ||
    input.careerGoals >= 5 ||
    input.careerKnockoutGoals >= 2 ||
    input.everReachedSemiOrBetter ||
    input.everReachedFinal
  ) {
    stars = 4;
  }

  if (input.everWonCup || (input.worldCupsPlayed >= 4 && input.careerGoals >= 3)) {
    stars = 5;
  }

  const shirt = input.shirtNumber;
  const iconicRun =
    shirt !== undefined &&
    ICONIC_SHIRTS_ATTACK.has(shirt) &&
    isAttackCoarsePosition(input.coarsePosition) &&
    input.editionStarts >= 3;

  if (iconicRun) {
    stars = Math.max(stars, 4) as InternationalReputation;
  }

  return stars;
}

export interface DerivePlayerOverallInput {
  edition: CareerOverallInput;
  career: CareerOverallInput;
  pedigree: CareerPedigreeInput;
}

/**
 * Edition + career blend, then FIFA-style reputation boost and pedigree floor.
 */
export function derivePlayerOverall(input: DerivePlayerOverallInput): number {
  const editionOvr = meritToOverallAbsolute(careerMeritScore(input.edition));
  const careerOvr = meritToOverallAbsolute(careerMeritScore(input.career));
  const base = Math.round(0.4 * editionOvr + 0.6 * careerOvr);

  const stars = inferInternationalReputation(input.pedigree);
  const boosted = base + internationalReputationBoost(base, stars);
  const floored = Math.max(boosted, reputationPedigreeFloor(stars));

  return clamp(floored, 0, OVR_CEILING);
}

/**
 * Map merit scores to overall ratings 0–100 on an ABSOLUTE scale.
 *
 * Ratings are squad-independent. Players with no career merit get a small
 * deterministic jitter around the bench base.
 */
export function meritsToOveralls(
  merits: ReadonlyMap<string, number>,
  jitterSeed: (playerKey: string) => string,
  hashMod: (seed: string) => number,
): Map<string, number> {
  const overalls = new Map<string, number>();
  for (const [key, merit] of merits) {
    if (merit <= 0) {
      const jitter = hashMod(jitterSeed(key)) % BENCH_SPREAD;
      overalls.set(key, BENCH_BASE + jitter);
    } else {
      overalls.set(key, meritToOverallAbsolute(merit));
    }
  }
  return overalls;
}

/** Single-player overall from one career input (legacy / tests). */
export function deriveOverall(input: CareerOverallInput): number {
  return meritToOverallAbsolute(careerMeritScore(input));
}

/** Whether a goal stage counts as knockout or later. */
export function isKnockoutStage(stageName: string): boolean {
  const s = stageName.trim().toLowerCase();
  return (
    s.includes("round of 16") ||
    s.includes("quarter") ||
    s.includes("semi") ||
    s === "final" ||
    s.includes("third-place")
  );
}

export function isFinalStage(stageName: string): boolean {
  return stageName.trim().toLowerCase() === "final";
}

export function isSemiOrBetterStage(stageName: string): boolean {
  const s = stageName.trim().toLowerCase();
  return s.includes("semi") || s === "final" || s.includes("third-place");
}
