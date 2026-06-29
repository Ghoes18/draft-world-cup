/**
 * ELO / ranking (post-MVP, PRD §9.9). Pure and deterministic — no DB, no I/O —
 * so it runs server-side unchanged from the Convex tournament mutation.
 *
 * Model: **per-fixture Elo**. Each fixture a participant plays in a resolved
 * World Cup (3 group + up to 2 knockout) is a classic Elo update against the
 * opponent's current rating; a group-stage draw scores 0.5. Going deep through
 * the knockout bracket therefore earns more rating, and beating a higher-rated
 * opponent earns more than beating a lower-rated one.
 *
 * Only human ratings are persisted by the caller; bot ratings are ephemeral and
 * seeded at `DEFAULT_ELO`.
 */

import type { TournamentMatch, TournamentParticipant } from "./tournament.js";

export const DEFAULT_ELO = 1500;
export const K_FACTOR = 24;

/** Expected score of `a` against `b` under the logistic Elo curve (0..1). */
export function expectedScore(a: number, b: number): number {
  return 1 / (1 + 10 ** ((b - a) / 400));
}

/**
 * One Elo update step. `actual` is the realised score (1 win / 0.5 draw / 0
 * loss). Returns the new (unrounded) rating; callers round on persistence.
 */
export function applyElo(rating: number, expected: number, actual: number): number {
  return rating + K_FACTOR * (actual - expected);
}

/** Per-slot rating outcome over a whole tournament. */
export interface SlotEloResult {
  slot: number;
  startRating: number;
  finalRating: number; // rounded
  delta: number; // rounded finalRating − rounded startRating
  wins: number;
  draws: number;
  losses: number;
  played: number;
}

export interface ComputeTournamentEloInput {
  participants: Pick<TournamentParticipant, "slot" | "kind" | "playerId">[];
  matches: Pick<
    TournamentMatch,
    "stage" | "homeSlot" | "awaySlot" | "winnerSlot"
  >[];
  /**
   * Seed ratings by slot. Humans should be seeded with their persisted rating;
   * any slot omitted (e.g. CPU bots) defaults to `DEFAULT_ELO`.
   */
  startRatings: Record<number, number>;
}

const STAGE_RANK: Record<TournamentMatch["stage"], number> = {
  group: 0,
  semi: 1,
  final: 2,
};

/**
 * Compute every slot's rating change across a resolved tournament by replaying
 * its fixtures in stage order (group → semi → final). Ratings update in place
 * so a participant's later fixtures see their freshly-updated rating.
 */
export function computeTournamentEloChanges(
  input: ComputeTournamentEloInput,
): SlotEloResult[] {
  const start: Record<number, number> = {};
  const current: Record<number, number> = {};
  const tally: Record<number, { wins: number; draws: number; losses: number; played: number }> = {};

  for (const p of input.participants) {
    const seed = input.startRatings[p.slot] ?? DEFAULT_ELO;
    start[p.slot] = seed;
    current[p.slot] = seed;
    tally[p.slot] = { wins: 0, draws: 0, losses: 0, played: 0 };
  }

  const ordered = [...input.matches].sort(
    (a, b) => STAGE_RANK[a.stage] - STAGE_RANK[b.stage],
  );

  for (const m of ordered) {
    const { homeSlot: h, awaySlot: a } = m;
    if (current[h] === undefined || current[a] === undefined) continue;

    // Realised score from the home perspective.
    let homeScore: number;
    if (m.winnerSlot === undefined) homeScore = 0.5;
    else if (m.winnerSlot === h) homeScore = 1;
    else homeScore = 0;
    const awayScore = 1 - homeScore;

    const rh = current[h];
    const ra = current[a];
    current[h] = applyElo(rh, expectedScore(rh, ra), homeScore);
    current[a] = applyElo(ra, expectedScore(ra, rh), awayScore);

    recordResult(tally[h]!, homeScore);
    recordResult(tally[a]!, awayScore);
  }

  return input.participants.map((p) => {
    const startRating = Math.round(start[p.slot]!);
    const finalRating = Math.round(current[p.slot]!);
    const t = tally[p.slot]!;
    return {
      slot: p.slot,
      startRating,
      finalRating,
      delta: finalRating - startRating,
      wins: t.wins,
      draws: t.draws,
      losses: t.losses,
      played: t.played,
    };
  });
}

function recordResult(
  t: { wins: number; draws: number; losses: number; played: number },
  score: number,
): void {
  t.played += 1;
  if (score === 1) t.wins += 1;
  else if (score === 0.5) t.draws += 1;
  else t.losses += 1;
}
