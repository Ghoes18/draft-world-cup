"use client";

import { useEffect, useState, type CSSProperties } from "react";
import { usePrefersReducedMotion } from "../../_hooks/useMotionPreference";

/**
 * A short, Vampire-Survivors-style radial pop: a ring + sparks that fire once
 * when `trigger` changes, then clean themselves up. Purely decorative, so it is
 * always `aria-hidden` and never mounts under reduced motion.
 *
 * Drop it inside a `position: relative` parent; it fills the parent and ignores
 * pointer events.
 */
export function ImpactBurst({
  trigger,
  tone = "home",
  sparks = 8,
}: {
  /** Any value that changes when a burst should fire (e.g. a goal index). */
  trigger: number | string | null;
  tone?: "home" | "away" | "gold";
  sparks?: number;
}) {
  const reduced = usePrefersReducedMotion();
  const [active, setActive] = useState<typeof trigger>(null);

  useEffect(() => {
    if (reduced || trigger == null) return;
    setActive(trigger);
    const id = setTimeout(() => setActive(null), 900);
    return () => clearTimeout(id);
  }, [trigger, reduced]);

  if (reduced || active == null) return null;

  return (
    <span className={`impact-burst impact-burst--${tone}`} key={String(active)} aria-hidden>
      <span className="impact-burst__ring" />
      {Array.from({ length: sparks }).map((_, i) => (
        <span
          key={i}
          className="impact-burst__spark"
          style={{ "--spark-angle": `${(360 / sparks) * i}deg` } as CSSProperties}
        />
      ))}
    </span>
  );
}
