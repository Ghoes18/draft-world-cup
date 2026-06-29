"use client";

import { ThreeCanvasGate } from "./ThreeCanvasGate";
import { lazyThreeScene } from "./lazyThreeScene";

const PitchAtmosphereScene = lazyThreeScene(() => import("./PitchAtmosphereScene"));

export function PitchAtmosphereBackdrop({ className }: { className?: string }) {
  return (
    <ThreeCanvasGate className={className ?? "three-backdrop three-backdrop--pitch"}>
      <PitchAtmosphereScene />
    </ThreeCanvasGate>
  );
}
