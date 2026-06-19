/**
 * Autoral player force (0–255) from World Cup appearance stats.
 *
 * Not live 7a0 forces — a deterministic placeholder until licensed squad JSON
 * is imported. Stars who started more matches score higher within each squad.
 */

import { hashSeed } from "../rng.js";

export interface PlayerAppearanceStats {
  starts: number;
  subs: number;
  goals: number;
}

const FORCE_FLOOR = 150;
const FORCE_CEILING = 245;
const BENCH_BASE = 155;
const BENCH_SPREAD = 35;

/** Raw merit score from tournament participation. */
export function appearanceMerit(stats: PlayerAppearanceStats): number {
  return stats.starts * 3 + stats.subs + stats.goals * 10;
}

/** Map merit scores for one squad to forces in 0–255. */
export function meritsToForces(
  merits: ReadonlyMap<string, number>,
  jitterSeed: (playerKey: string) => string,
): Map<string, number> {
  const forces = new Map<string, number>();
  if (merits.size === 0) return forces;

  let min = Infinity;
  let max = -Infinity;
  for (const m of merits.values()) {
    if (m < min) min = m;
    if (m > max) max = m;
  }

  for (const [key, merit] of merits) {
    let force: number;
    if (max === min || merit === 0) {
      const jitter = hashSeed(jitterSeed(key)) % BENCH_SPREAD;
      force = BENCH_BASE + jitter;
    } else {
      const t = (merit - min) / (max - min);
      force = Math.round(FORCE_FLOOR + t * (FORCE_CEILING - FORCE_FLOOR));
    }
    forces.set(key, Math.min(255, Math.max(0, force)));
  }

  return forces;
}
