"use client";

import type { ReactNode } from "react";

/**
 * A badge / headline that slams down like a referee's full-time stamp.
 *
 * The slam itself is a CSS keyframe (`stamp-in`) that collapses to an instant
 * appearance under reduced motion. Use for FT verdicts, achievement badges and
 * "ADVANCE" beats between fixtures.
 */
export function StampReveal({
  children,
  className = "",
  tone = "neutral",
  as: Tag = "div",
}: {
  children: ReactNode;
  className?: string;
  tone?: "neutral" | "home" | "away" | "gold";
  as?: "div" | "span" | "h2" | "h3" | "p";
}) {
  return (
    <Tag
      className={["stamp-reveal", `stamp-reveal--${tone}`, className]
        .filter(Boolean)
        .join(" ")}
    >
      {children}
    </Tag>
  );
}
