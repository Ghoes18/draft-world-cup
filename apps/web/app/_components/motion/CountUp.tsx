"use client";

import { useEffect, useRef, useState } from "react";
import { usePrefersReducedMotion } from "../../_hooks/useMotionPreference";

/**
 * Smoothly counts a displayed number toward `target` with an ease-out curve.
 *
 * Extracted from MatchView's match-clock roll so any surface (stats, scores,
 * ratings) can reuse the same motion. Respects reduced motion by jumping
 * straight to the target.
 */
export function useCountUp(
  target: number,
  { active = true, maxDurationMs = 750 }: { active?: boolean; maxDurationMs?: number } = {},
): number {
  const reduced = usePrefersReducedMotion();
  const [n, setN] = useState(target);
  const fromRef = useRef(target);

  useEffect(() => {
    if (!active || reduced || typeof requestAnimationFrame === "undefined") {
      fromRef.current = target;
      setN(target);
      return;
    }
    const from = fromRef.current;
    if (from === target) return;
    const dur = Math.min(maxDurationMs, 140 + Math.abs(target - from) * 16);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / dur);
      const eased = 1 - Math.pow(1 - p, 3);
      setN(Math.round(from + (target - from) * eased));
      if (p < 1) raf = requestAnimationFrame(step);
      else fromRef.current = target;
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, active, reduced, maxDurationMs]);

  return n;
}

/**
 * Renders a number that rolls up when it enters / changes. `decimals` keeps a
 * fixed precision (e.g. xG to one decimal); the easing runs on the integer
 * representation so the digits tick rather than flicker.
 */
export function CountUp({
  value,
  decimals = 0,
  active = true,
  prefix = "",
  suffix = "",
  className,
}: {
  value: number;
  decimals?: number;
  active?: boolean;
  prefix?: string;
  suffix?: string;
  className?: string;
}) {
  const scale = 10 ** decimals;
  const rolled = useCountUp(Math.round(value * scale), { active });
  const shown = (rolled / scale).toFixed(decimals);
  return (
    <span className={className}>
      {prefix}
      {shown}
      {suffix}
    </span>
  );
}
