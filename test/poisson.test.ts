import { describe, expect, it } from "vitest";
import { poissonKnuth } from "../src/poisson.js";
import { mulberry32 } from "../src/rng.js";

describe("poissonKnuth", () => {
  it("returns 0 for non-positive lambda", () => {
    const r = mulberry32(1);
    expect(poissonKnuth(0, r)).toBe(0);
    expect(poissonKnuth(-1, r)).toBe(0);
  });

  it("has a sample mean close to lambda", () => {
    for (const lambda of [0.5, 1.4, 3]) {
      const r = mulberry32(42);
      const n = 50_000;
      let sum = 0;
      for (let i = 0; i < n; i++) sum += poissonKnuth(lambda, r);
      const mean = sum / n;
      // Poisson mean == variance == lambda; allow a small statistical margin.
      expect(Math.abs(mean - lambda)).toBeLessThan(0.05);
    }
  });

  it("is deterministic for a given stream", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    const seqA = Array.from({ length: 100 }, () => poissonKnuth(1.4, a));
    const seqB = Array.from({ length: 100 }, () => poissonKnuth(1.4, b));
    expect(seqA).toEqual(seqB);
  });

  it("never returns negative counts", () => {
    const r = mulberry32(5);
    for (let i = 0; i < 1000; i++) {
      expect(poissonKnuth(2, r)).toBeGreaterThanOrEqual(0);
    }
  });
});
