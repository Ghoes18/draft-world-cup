"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { usePrefersReducedMotion } from "../../_hooks/useMotionPreference";

/** One-time WebGL capability probe. */
function hasWebGL(): boolean {
  if (typeof document === "undefined") return false;
  try {
    const canvas = document.createElement("canvas");
    return Boolean(
      window.WebGLRenderingContext &&
        (canvas.getContext("webgl") || canvas.getContext("experimental-webgl")),
    );
  } catch {
    return false;
  }
}

/**
 * Decides whether a decorative 3D scene may mount.
 *
 * The Three.js layer is strictly optional flavour, so it only renders when ALL
 * of the following hold:
 *  - the user has not asked for reduced motion;
 *  - WebGL is actually available;
 *  - (optionally) the host element has scrolled into view.
 *
 * Otherwise it renders `fallback` (typically nothing or a static CSS layer),
 * guaranteeing the app is fully usable without a GPU. The 3D children are also
 * client-only — callers pass them via `next/dynamic(..., { ssr: false })`.
 */
export function ThreeCanvasGate({
  children,
  fallback = null,
  requireVisible = true,
  className = "three-backdrop",
}: {
  children: ReactNode;
  fallback?: ReactNode;
  requireVisible?: boolean;
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const [capable, setCapable] = useState(false);
  const [visible, setVisible] = useState(!requireVisible);

  useEffect(() => {
    setCapable(!reduced && hasWebGL());
  }, [reduced]);

  useEffect(() => {
    if (!requireVisible) return;
    const el = ref.current;
    if (!el || typeof IntersectionObserver === "undefined") {
      setVisible(true);
      return;
    }
    const obs = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (e.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { rootMargin: "120px" },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [requireVisible]);

  const show = capable && visible && !reduced;

  return (
    <div ref={ref} className={className} aria-hidden>
      {show ? children : fallback}
    </div>
  );
}
