/**
 * Poisson sampler via Knuth's multiplicative algorithm — the model that turns
 * expected goals (λ) into an actual scoreline. Draws from the supplied seeded
 * RNG so results stay deterministic and reproducible.
 */

import type { Rng } from "./rng.js";

/**
 * Sample k ~ Poisson(lambda).
 *
 * Knuth's method: multiply uniforms until the product drops below e^(-λ).
 * λ is clamped upstream to [0.15, 5] (see engine), so the loop is cheap and
 * there is no overflow concern, but we guard λ ≤ 0 defensively.
 */
export function poissonKnuth(lambda: number, rng: Rng): number {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0;
  let p = 1;
  do {
    k++;
    p *= rng();
  } while (p > L);
  return k - 1;
}
