"use client";

import { useEffect, useMemo, useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";
import { ThreeCanvasShell } from "./ThreeCanvasShell";

const COUNT = 30;

/** Drifting two-kit motes — floodlit dust rising over the pitch. */
function Motes() {
  const ref = useRef<THREE.InstancedMesh>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const seeds = useMemo(
    () =>
      Array.from({ length: COUNT }, () => ({
        x: (Math.random() - 0.5) * 11,
        y: (Math.random() - 0.5) * 9,
        z: (Math.random() - 0.5) * 4 - 1.5,
        s: 0.04 + Math.random() * 0.1,
        speed: 0.12 + Math.random() * 0.3,
        home: Math.random() > 0.45,
      })),
    [],
  );

  useEffect(() => {
    const mesh = ref.current;
    if (!mesh) return;
    const home = new THREE.Color("#c6f24e");
    const away = new THREE.Color("#ff5436");
    for (let i = 0; i < COUNT; i++) {
      mesh.setColorAt(i, seeds[i]!.home ? home : away);
    }
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }, [seeds]);

  useFrame((state, delta) => {
    const mesh = ref.current;
    if (!mesh) return;
    for (let i = 0; i < COUNT; i++) {
      const m = seeds[i]!;
      m.y += delta * m.speed;
      if (m.y > 4.8) m.y = -4.8;
      dummy.position.set(m.x, m.y, m.z);
      const pulse = 1 + Math.sin(state.clock.elapsedTime * m.speed * 2 + i) * 0.25;
      dummy.scale.setScalar(m.s * pulse);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
  });

  return (
    <instancedMesh ref={ref} args={[undefined, undefined, COUNT]}>
      <sphereGeometry args={[1, 8, 8]} />
      <meshBasicMaterial transparent opacity={0.55} toneMapped={false} />
    </instancedMesh>
  );
}

/** A faint wireframe dome that turns slowly — a hint of stadium architecture. */
function Dome() {
  const ref = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (ref.current) ref.current.rotation.y += delta * 0.04;
  });
  return (
    <mesh ref={ref} position={[0, -1, -3]} scale={6}>
      <icosahedronGeometry args={[1, 1]} />
      <meshBasicMaterial color="#1d4a2e" wireframe transparent opacity={0.22} />
    </mesh>
  );
}

export default function HeroStadiumScene() {
  return (
    <ThreeCanvasShell camera={{ position: [0, 0, 9], fov: 55 }}>
      <fog attach="fog" args={["#06120c", 9, 18]} />
      <Dome />
      <Motes />
    </ThreeCanvasShell>
  );
}
