"use client";

import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ThreeCanvasShell } from "./ThreeCanvasShell";

/** A slow gold glint sweeping behind a card — the optional WebGL foil layer. */
function Glint() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((state) => {
    if (!ref.current) return;
    ref.current.position.x = Math.sin(state.clock.elapsedTime * 0.5) * 1.4;
    ref.current.rotation.z = Math.PI / 6;
  });
  return (
    <mesh ref={ref}>
      <planeGeometry args={[0.6, 4]} />
      <meshBasicMaterial color="#d7b55b" transparent opacity={0.25} toneMapped={false} />
    </mesh>
  );
}

export default function HoloCardMesh() {
  return (
    <ThreeCanvasShell camera={{ position: [0, 0, 3], fov: 45 }}>
      <Glint />
    </ThreeCanvasShell>
  );
}
