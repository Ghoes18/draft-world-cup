/**
 * Deterministic, shareable RNG.
 *
 * mulberry32 is the exact generator the live game uses, so a given seed
 * reproduces the same draw + simulation everywhere (clients, server, replays).
 * Seeds in the timeline schema are strings (server-owned), so `hashSeed` maps a
 * string to the uint32 state mulberry32 expects. Everything downstream draws
 * from one stream, keeping replays/highlights byte-for-byte reproducible.
 */

/** A function returning the next float in [0, 1). */
export type Rng = () => number;

/** mulberry32 — fast, deterministic 32-bit PRNG. */
export function mulberry32(seed: number): Rng {
  let a = seed >>> 0;
  return function next(): number {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Hash an arbitrary seed string to a uint32 (FNV-1a). Stable across runs and
 * platforms; used to seed mulberry32 from the server-owned seed string.
 */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5; // FNV offset basis
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193); // FNV prime
  }
  return h >>> 0;
}

/** Build an RNG directly from a seed string. */
export function rngFromSeed(seed: string): Rng {
  return mulberry32(hashSeed(seed));
}

/** Integer in [min, max] inclusive. */
export function randInt(rng: Rng, min: number, max: number): number {
  return min + Math.floor(rng() * (max - min + 1));
}

/** Pick a random element of a non-empty array. */
export function pick<T>(rng: Rng, items: readonly T[]): T {
  if (items.length === 0) throw new Error("pick() on empty array");
  return items[Math.floor(rng() * items.length)]!;
}
