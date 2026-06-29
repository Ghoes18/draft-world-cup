"use client";

import { useRef, useState, type PointerEvent, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../_hooks/useMotionPreference";
import { lazyThreeScene } from "./lazyThreeScene";

// Optional WebGL foil layer — only pulled in when a caller opts into `webgl`.
const HoloCardMesh = lazyThreeScene(() => import("./HoloCardMesh"));

/**
 * A collectible "holo" card wrapper. By default it uses a cheap, performant CSS
 * pointer-tilt with the shared foil sweep — no GPU canvas — so it can wrap many
 * cards (legends, boss, special results) safely. Pass `webgl` to additionally
 * mount a decorative Three.js glint behind the content. Reduced motion flattens
 * it to a static card.
 */
export function HoloCard3D({
  children,
  className = "",
  tone = "gold",
  webgl = false,
}: {
  children: ReactNode;
  className?: string;
  tone?: "gold" | "home" | "away";
  webgl?: boolean;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [tilt, setTilt] = useState({ rx: 0, ry: 0 });

  function onMove(e: PointerEvent<HTMLDivElement>) {
    if (reduced) return;
    const el = ref.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const px = (e.clientX - r.left) / r.width - 0.5;
    const py = (e.clientY - r.top) / r.height - 0.5;
    setTilt({ rx: -py * 9, ry: px * 12 });
  }

  function reset() {
    setTilt({ rx: 0, ry: 0 });
  }

  return (
    <div
      ref={ref}
      className={["holo-card", `holo-card--${tone}`, "holo-foil", className]
        .filter(Boolean)
        .join(" ")}
      onPointerMove={onMove}
      onPointerLeave={reset}
      style={
        reduced
          ? undefined
          : {
              transform: `perspective(720px) rotateX(${tilt.rx}deg) rotateY(${tilt.ry}deg)`,
            }
      }
    >
      {webgl && !reduced ? <HoloCardMesh /> : null}
      {children}
    </div>
  );
}
