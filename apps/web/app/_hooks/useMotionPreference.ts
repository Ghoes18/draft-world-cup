"use client";

import { useEffect, useState } from "react";

/**
 * Single source of truth for "should we play rich motion?".
 *
 * Wraps `prefers-reduced-motion` so every animated surface (casino roulette,
 * motion primitives, the Three.js gate) reads the same signal instead of each
 * re-implementing its own media-query listener. When this returns `true`,
 * callers must degrade to an instant, non-animated state and must not mount any
 * 3D canvas.
 */
export function usePrefersReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const onChange = () => setReduced(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  return reduced;
}

/**
 * Convenience inverse: `true` when rich motion is welcome. Kept as its own hook
 * so component code reads naturally (`if (animate) …`).
 */
export function useMotionPreference(): { reduced: boolean; animate: boolean } {
  const reduced = usePrefersReducedMotion();
  return { reduced, animate: !reduced };
}
