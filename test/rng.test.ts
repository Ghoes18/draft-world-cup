import { describe, expect, it } from "vitest";
import { hashSeed, mulberry32, randInt, rngFromSeed } from "../src/rng.js";

describe("mulberry32", () => {
  it("is deterministic for a given seed", () => {
    const a = mulberry32(12345);
    const b = mulberry32(12345);
    const seqA = Array.from({ length: 20 }, () => a());
    const seqB = Array.from({ length: 20 }, () => b());
    expect(seqA).toEqual(seqB);
  });

  it("produces floats in [0, 1)", () => {
    const r = mulberry32(99);
    for (let i = 0; i < 1000; i++) {
      const v = r();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
    }
  });

  it("diverges for different seeds", () => {
    const a = mulberry32(1)();
    const b = mulberry32(2)();
    expect(a).not.toBe(b);
  });
});

describe("hashSeed", () => {
  it("maps strings to a stable uint32", () => {
    expect(hashSeed("demo123")).toBe(hashSeed("demo123"));
    expect(hashSeed("demo123")).not.toBe(hashSeed("demo124"));
    const h = hashSeed("anything");
    expect(Number.isInteger(h)).toBe(true);
    expect(h).toBeGreaterThanOrEqual(0);
    expect(h).toBeLessThanOrEqual(0xffffffff);
  });
});

describe("rngFromSeed", () => {
  it("reproduces the same stream from the same seed string", () => {
    const a = rngFromSeed("cup-run");
    const b = rngFromSeed("cup-run");
    expect(Array.from({ length: 10 }, () => a())).toEqual(
      Array.from({ length: 10 }, () => b()),
    );
  });
});

describe("randInt", () => {
  it("stays within inclusive bounds", () => {
    const r = mulberry32(7);
    for (let i = 0; i < 1000; i++) {
      const v = randInt(r, 3, 9);
      expect(v).toBeGreaterThanOrEqual(3);
      expect(v).toBeLessThanOrEqual(9);
    }
  });
});
