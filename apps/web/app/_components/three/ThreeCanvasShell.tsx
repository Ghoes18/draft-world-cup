"use client";

import { Canvas } from "@react-three/fiber";
import type { ComponentProps, ReactNode } from "react";

type CanvasProps = ComponentProps<typeof Canvas>;

/**
 * A `<Canvas>` pre-tuned for the low-power "ambient flavour" tier:
 * clamped DPR, no antialiasing, transparent background and low-power GL. Every
 * scene renders through this so budgets stay consistent (one soft light, no
 * post-processing). It fills its positioned parent and ignores pointer events.
 */
export function ThreeCanvasShell({
  children,
  ...props
}: { children: ReactNode } & Partial<CanvasProps>) {
  return (
    <Canvas
      dpr={[1, 1.5]}
      gl={{ antialias: false, powerPreference: "low-power", alpha: true }}
      style={{ position: "absolute", inset: 0, pointerEvents: "none" }}
      {...props}
    >
      {children}
    </Canvas>
  );
}
