"use client";

import { useEffect, useMemo, useRef, useSyncExternalStore, type MutableRefObject } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { AdaptiveDpr } from "@react-three/drei";
import * as THREE from "three";

const NODE_POSITIONS: [number, number, number][] = [
  [1.55, 0.55, 0.35],
  [-1.45, 0.7, 0.4],
  [0.95, -0.85, 0.7],
  [-0.7, -0.55, -1.05],
  [1.15, 0.85, -0.75],
  [-1.25, 0.15, 0.95],
];

function usePaused() {
  const paused = useRef(false);
  useEffect(() => {
    const onVis = () => {
      paused.current = document.visibilityState !== "visible";
    };
    onVis();
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, []);
  return paused;
}

function SceneLights() {
  return (
    <>
      <ambientLight intensity={0.28} />
      <pointLight position={[2.4, 1.8, 2.2]} intensity={18} distance={9} color="#9aa6ff" />
      <pointLight position={[-2.6, -0.4, 1.4]} intensity={10} distance={8} color="#6f8ec8" />
      <directionalLight position={[0, 3, 2]} intensity={0.55} color="#d7dcff" />
    </>
  );
}

function Core({ paused }: { paused: MutableRefObject<boolean> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (paused.current || !ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.rotation.y = t * 0.12;
    ref.current.rotation.x = Math.sin(t * 0.18) * 0.08;
    ref.current.position.y = Math.sin(t * 0.35) * 0.08;
  });

  return (
    <group ref={ref}>
      <mesh>
        <icosahedronGeometry args={[0.72, 1]} />
        <meshPhysicalMaterial
          color="#c9cedd"
          metalness={0.72}
          roughness={0.22}
          transparent
          opacity={0.92}
          reflectivity={0.8}
        />
      </mesh>
      <mesh>
        <icosahedronGeometry args={[0.78, 0]} />
        <meshBasicMaterial color="#aeb8ff" wireframe transparent opacity={0.28} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.38, 24, 24]} />
        <meshBasicMaterial color="#7c87d6" transparent opacity={0.35} />
      </mesh>
    </group>
  );
}

function Nodes({ paused }: { paused: MutableRefObject<boolean> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (paused.current || !ref.current) return;
    ref.current.rotation.y = state.clock.elapsedTime * 0.08;
  });

  return (
    <group ref={ref}>
      {NODE_POSITIONS.map((pos, i) => (
        <mesh key={i} position={pos}>
          <octahedronGeometry args={[0.07, 0]} />
          <meshStandardMaterial
            color="#d5dbff"
            emissive="#7c87d6"
            emissiveIntensity={0.55}
            metalness={0.4}
            roughness={0.3}
          />
        </mesh>
      ))}
    </group>
  );
}

function Links() {
  const geometry = useMemo(() => {
    const positions: number[] = [];
    for (const pos of NODE_POSITIONS) {
      positions.push(0, 0, 0, ...pos);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
    return geo;
  }, []);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#8b95d4" transparent opacity={0.28} />
    </lineSegments>
  );
}

function Workstation({ paused }: { paused: MutableRefObject<boolean> }) {
  const ref = useRef<THREE.Group>(null);
  useFrame((state) => {
    if (paused.current || !ref.current) return;
    const t = state.clock.elapsedTime;
    ref.current.position.y = Math.sin(t * 0.4 + 0.6) * 0.05;
  });

  return (
    <group ref={ref}>
      <mesh position={[-1.85, -0.15, 0.35]} rotation={[0.12, 0.4, 0.08]}>
        <cylinderGeometry args={[0.22, 0.22, 0.42, 16]} />
        <meshStandardMaterial color="#9aa3c4" metalness={0.55} roughness={0.35} />
      </mesh>
      <mesh position={[1.75, 0.45, -0.25]} rotation={[-0.18, -0.4, 0.1]}>
        <boxGeometry args={[0.72, 0.48, 0.04]} />
        <meshStandardMaterial color="#1a1d28" metalness={0.2} roughness={0.4} />
      </mesh>
      <mesh position={[1.75, 0.45, -0.22]} rotation={[-0.18, -0.4, 0.1]}>
        <boxGeometry args={[0.62, 0.36, 0.01]} />
        <meshBasicMaterial color="#5d6bb8" transparent opacity={0.45} />
      </mesh>
      <mesh position={[0.15, -1.15, 0.55]} rotation={[0.3, 0.2, -0.08]}>
        <boxGeometry args={[0.7, 0.42, 0.05]} />
        <meshStandardMaterial color="#14161f" metalness={0.25} roughness={0.45} />
      </mesh>
      {[0, 1, 2, 3].map((i) => (
        <mesh
          key={i}
          position={[-0.12 + i * 0.08, -1.22 + i * 0.04, 0.58]}
          rotation={[0.3, 0.2, -0.08]}
        >
          <boxGeometry args={[0.38 - i * 0.05, 0.025, 0.01]} />
          <meshBasicMaterial color="#aeb8ff" transparent opacity={0.55} />
        </mesh>
      ))}
      {[0, 1, 2, 3, 4].map((i) => (
        <mesh
          key={`code-${i}`}
          position={[-0.9 + i * 0.42, 1.05 - (i % 2) * 0.18, -0.55]}
          rotation={[0.2, 0.4, 0.1]}
        >
          <boxGeometry args={[0.28 + (i % 3) * 0.08, 0.03, 0.01]} />
          <meshBasicMaterial color="#c5ccf0" transparent opacity={0.4} />
        </mesh>
      ))}
    </group>
  );
}

function Rig({ paused }: { paused: MutableRefObject<boolean> }) {
  useFrame((state) => {
    if (paused.current) return;
    const cam = state.camera;
    cam.position.x = THREE.MathUtils.lerp(cam.position.x, 0.15 + state.pointer.x * 0.45, 0.035);
    cam.position.y = THREE.MathUtils.lerp(cam.position.y, 0.2 + state.pointer.y * 0.22, 0.035);
    cam.lookAt(0, 0, 0);
  });
  return null;
}

function subscribeVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

function getFrameLoop(): "always" | "never" {
  return document.visibilityState === "visible" ? "always" : "never";
}

export default function WorkspaceCanvas() {
  const paused = usePaused();
  const loop = useSyncExternalStore(subscribeVisibility, getFrameLoop, () => "always" as const);

  return (
    <Canvas
      frameloop={loop}
      dpr={[1, 1.5]}
      gl={{
        antialias: false,
        alpha: true,
        powerPreference: "low-power",
        stencil: false,
        depth: true,
      }}
      camera={{ position: [0, 0.2, 5.4], fov: 36 }}
      onCreated={({ gl }) => {
        gl.setClearColor(0x000000, 0);
      }}
      style={{ width: "100%", height: "100%", background: "transparent" }}
      aria-hidden
    >
      <SceneLights />
      <AdaptiveDpr pixelated />
      <fog attach="fog" args={["#07070c", 6.5, 12]} />
      <Core paused={paused} />
      <Nodes paused={paused} />
      <Links />
      <Workstation paused={paused} />
      <Rig paused={paused} />
    </Canvas>
  );
}
