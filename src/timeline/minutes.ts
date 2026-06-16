/**
 * Goal-minute placement. No source distribution exists in this repo, so M1
 * spreads goals across the playable window using equal-width buckets (one goal
 * per bucket, random minute within it). This guarantees ascending order and
 * avoids clustering without rejection sampling. Tunable (MVP §9 / PRD §15).
 */

import { GOAL_MAX_MINUTE, GOAL_MIN_MINUTE } from "../constants.js";
import { randInt, type Rng } from "../rng.js";

/** Return `count` distinct-ish goal minutes in ascending order. */
export function placeGoalMinutes(count: number, rng: Rng): number[] {
  if (count <= 0) return [];
  const lo = GOAL_MIN_MINUTE;
  const hi = GOAL_MAX_MINUTE;
  const span = hi - lo;
  const minutes: number[] = [];
  for (let i = 0; i < count; i++) {
    const bucketLo = Math.round(lo + (span * i) / count);
    const bucketHi = Math.round(lo + (span * (i + 1)) / count) - 1;
    minutes.push(randInt(rng, bucketLo, Math.max(bucketLo, bucketHi)));
  }
  return minutes;
}
