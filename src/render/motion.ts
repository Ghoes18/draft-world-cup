import type { Vec2 } from "../types.js";
import { mulberry32, hashSeed } from "../rng.js";
import { IDLE_NOISE_AMP } from "./constants.js";

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

export function lerpVec(a: Vec2, b: Vec2, t: number): Vec2 {
  return { x: lerp(a.x, b.x, t), y: lerp(a.y, b.y, t) };
}

/** Smoothstep easing in [0,1]. */
export function easeInOut(t: number): number {
  const c = Math.max(0, Math.min(1, t));
  return c * c * (3 - 2 * c);
}

/** Quadratic Bézier: P0 → P2 with control P1 lifted perpendicular to the chord. */
export function quadraticBezier(
  p0: Vec2,
  p2: Vec2,
  t: number,
  lift = 0.15,
): Vec2 {
  const c = easeInOut(t);
  const mid = { x: (p0.x + p2.x) / 2, y: (p0.y + p2.y) / 2 };
  const dx = p2.x - p0.x;
  const dy = p2.y - p0.y;
  const len = Math.hypot(dx, dy) || 1;
  const p1 = {
    x: mid.x + (-dy / len) * lift,
    y: mid.y + (dx / len) * lift,
  };
  const u = 1 - c;
  return {
    x: u * u * p0.x + 2 * u * c * p1.x + c * c * p2.x,
    y: u * u * p0.y + 2 * u * c * p1.y + c * c * p2.y,
  };
}

export function clamp01(v: number): number {
  return Math.max(0, Math.min(1, v));
}

export function clampVec(v: Vec2): Vec2 {
  return { x: clamp01(v.x), y: clamp01(v.y) };
}

/**
 * Deterministic idle sway for a player token. Uses mulberry32 keyed by
 * player id + seed so the same timeline always looks the same.
 */
export function idleNoise(
  playerId: string,
  matchTimeMin: number,
  seed: string,
): Vec2 {
  const rng = mulberry32(hashSeed(`${seed}:idle:${playerId}`));
  const phase = matchTimeMin * 2.1 + rng() * 10;
  const nx = Math.sin(phase * 1.7 + rng() * 6.28) * IDLE_NOISE_AMP;
  const ny = Math.cos(phase * 1.3 + rng() * 6.28) * IDLE_NOISE_AMP;
  return { x: nx, y: ny };
}
