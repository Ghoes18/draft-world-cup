"use client";

import { Children, type ReactNode, type CSSProperties } from "react";

/**
 * Reveals its children one after another with a small upward fade.
 *
 * Pure CSS (animation-delay per index) so it costs nothing on the main thread
 * and is fully disabled under reduced motion via globals.css. Children keep
 * their own keys; wrap each in a positioned span so transforms don't disturb
 * layout.
 */
export function StaggerIn({
  children,
  step = 60,
  initialDelay = 0,
  className = "",
  as: Tag = "div",
  style,
}: {
  children: ReactNode;
  /** Delay between successive items (ms). */
  step?: number;
  /** Delay before the first item (ms). */
  initialDelay?: number;
  className?: string;
  as?: "div" | "ul" | "ol" | "section";
  style?: CSSProperties;
}) {
  const items = Children.toArray(children);
  return (
    <Tag className={["stagger-in", className].filter(Boolean).join(" ")} style={style}>
      {items.map((child, i) => (
        <div
          key={i}
          className="stagger-in__item"
          style={{ animationDelay: `${initialDelay + i * step}ms` }}
        >
          {child}
        </div>
      ))}
    </Tag>
  );
}
