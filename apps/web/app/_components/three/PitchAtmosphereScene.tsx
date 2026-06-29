"use client";

import { useMemo } from "react";
import * as THREE from "three";
import { ThreeCanvasShell } from "./ThreeCanvasShell";

/** Mown-grass stripe texture: alternating broadcast-style bands. */
function useGrassTexture(): THREE.CanvasTexture | null {
  return useMemo(() => {
    if (typeof document === "undefined") return null;
    const c = document.createElement("canvas");
    c.width = 4;
    c.height = 512;
    const ctx = c.getContext("2d");
    if (!ctx) return null;
    const stripes = 24;
    const h = 512 / stripes;
    for (let i = 0; i < stripes; i++) {
      ctx.fillStyle = i % 2 === 0 ? "#16522c" : "#0f3e21";
      ctx.fillRect(0, Math.floor(i * h), 4, Math.ceil(h));
    }
    const tex = new THREE.CanvasTexture(c);
    tex.wrapS = THREE.RepeatWrapping;
    tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(1, 1);
    return tex;
  }, []);
}

function GrassField() {
  const tex = useGrassTexture();
  return (
    <mesh
      rotation={[-Math.PI / 2.2, 0, 0]}
      position={[0, -0.35, 0.4]}
      scale={[9, 14, 1]}
    >
      <planeGeometry args={[1, 1, 1, 1]} />
      {/* MeshBasicMaterial is unaffected by lights — uniform colour everywhere */}
      <meshBasicMaterial
        map={tex ?? undefined}
        color="#183d28"
        transparent
        opacity={0.52}
        toneMapped={false}
      />
    </mesh>
  );
}

export default function PitchAtmosphereScene() {
  return (
    <ThreeCanvasShell camera={{ position: [0, 1.9, 4.8], fov: 50 }}>
      <fog attach="fog" args={["#04100a", 6, 14]} />
      <GrassField />
    </ThreeCanvasShell>
  );
}
