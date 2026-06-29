"use client";

import type { ButtonHTMLAttributes, ReactNode } from "react";

/**
 * A tactile, press-satisfying button wrapper (FIFA-card / sticker feel).
 *
 * Adds the `.pressable` class that drives the hard-shadow press animation in
 * globals.css; reduced motion is handled there. It is a plain <button> so it
 * keeps native focus, keyboard and disabled semantics.
 */
export function PressableCard({
  children,
  className = "",
  glow = false,
  ...rest
}: {
  children: ReactNode;
  className?: string;
  /** Adds a subtle accent halo — use for the "active / chosen" state. */
  glow?: boolean;
} & ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={["pressable", glow ? "pressable--glow" : "", className]
        .filter(Boolean)
        .join(" ")}
      {...rest}
    >
      {children}
    </button>
  );
}
