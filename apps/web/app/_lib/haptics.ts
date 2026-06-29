/**
 * Tier-scaled haptic feedback for placement. No-op on devices/browsers without
 * the Vibration API (most desktops, iOS Safari).
 */

import type { PlayerTier } from "7a0-engine";

const PATTERN: Record<PlayerTier, number | number[]> = {
  bronze: 10,
  silver: 10,
  gold: 10,
  elite: 20,
  legend: [15, 30, 15],
  icon: [20, 40, 20],
};

export function vibrateForTier(tier: PlayerTier): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") {
    return;
  }
  try {
    navigator.vibrate(PATTERN[tier]);
  } catch {
    /* ignore */
  }
}
