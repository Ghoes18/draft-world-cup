"use client";

import { ThreeCanvasGate } from "./ThreeCanvasGate";
import { lazyThreeScene } from "./lazyThreeScene";

// Client-only and lazy: keeps three/fiber out of the main bundle and off the
// server. The hero is above the fold, so we don't wait for visibility.
const HeroStadiumScene = lazyThreeScene(() => import("./HeroStadiumScene"));

export function HeroStadiumBackdrop({ className }: { className?: string }) {
  return (
    <ThreeCanvasGate className={className ?? "three-backdrop three-backdrop--hero"} requireVisible={false}>
      <HeroStadiumScene />
    </ThreeCanvasGate>
  );
}
