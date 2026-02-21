'use client';

import { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, Environment } from '@react-three/drei';
import * as THREE from 'three';
import { useTwinStore } from '@/store/twinStore';

// Stress coloring: backend sends stress_factor in [0, 1] (0 = no load, 1 = max stress at 8000 RPM)
const STRESS_COLOR_LOW = new THREE.Color(0x3b82f6);   // blue — default / low stress
const STRESS_COLOR_HIGH = new THREE.Color(0xef4444);  // red — high stress
const STEEL = new THREE.Color(0x8899aa);
const DEFAULT_STRESS_FACTOR = 0;  // when disconnected or no data, show blue
const colorBuf = new THREE.Color();
const colorBuf2 = new THREE.Color();

// Crank-slider mechanism dimensions (visual units)
const R = 0.35;
const L = 1.1;

// Physics constants (must match backend PhysicsEngine.h)
const CRANK_THROW = 0.04;
const CON_ROD_LEN = 0.128;
const PISTON_MASS = 0.4;
const LAMBDA = CRANK_THROW / CON_ROD_LEN;
const OMEGA_MAX = (8000 * 2 * Math.PI) / 60;
const MAX_PISTON_FORCE = PISTON_MASS * CRANK_THROW * OMEGA_MAX * OMEGA_MAX * (1 + LAMBDA);
const MAX_ARROW_LEN = 0.8;
const MIN_ARROW_LEN = 0.08;

function arrowLen(forceN: number): number {
  const norm = Math.sqrt(Math.abs(forceN) / MAX_PISTON_FORCE);
  return Math.min(MAX_ARROW_LEN, Math.max(MIN_ARROW_LEN, norm * MAX_ARROW_LEN));
}
const JOURNAL_R = 0.12;
const PIN_R = 0.08;
const WEB_THICK = 0.06;
const CW_DEPTH = 0.32;
const CW_HEIGHT = 0.25;
const PISTON_R = 0.22;
const PISTON_H = 0.3;
const BORE_R = 0.26;
const BORE_H = 1.3;
// Z-axis crankshaft layout (no overlaps)
const WEB_CENTER_Z = 0.11;
const WEB_HALF_Z = WEB_THICK / 2;                       // 0.03
const WEB_INNER_Z = WEB_CENTER_Z - WEB_HALF_Z;          // 0.08
const WEB_OUTER_Z = WEB_CENTER_Z + WEB_HALF_Z;          // 0.14
const SHAFT_END_Z = 0.35;
const JOURNAL_LEN = SHAFT_END_Z - WEB_OUTER_Z;          // 0.21
const JOURNAL_CENTER_Z = (SHAFT_END_Z + WEB_OUTER_Z) / 2; // 0.245
const PIN_LEN = WEB_INNER_Z * 2;                         // 0.16

function CrankshaftWithPiston() {
  const crankRef = useRef<THREE.Group>(null);
  const rodRef = useRef<THREE.Group>(null);
  const pistonRef = useRef<THREE.Group>(null);

  const crankMat = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.75, roughness: 0.2 }),
    [],
  );
  const rodMat = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.6, roughness: 0.3, color: STEEL }),
    [],
  );
  const pistonMat = useMemo(
    () => new THREE.MeshStandardMaterial({ metalness: 0.7, roughness: 0.2 }),
    [],
  );

  useEffect(() => {
    return () => {
      crankMat.dispose();
      rodMat.dispose();
      pistonMat.dispose();
    };
  }, [crankMat, rodMat, pistonMat]);

  useFrame(() => {
    const latest = useTwinStore.getState().latest;
    const angle = latest.angle_rad ?? 0;
    const sf = typeof latest.stress_factor === 'number' && Number.isFinite(latest.stress_factor)
      ? Math.max(0, Math.min(1, latest.stress_factor))
      : DEFAULT_STRESS_FACTOR;

    if (crankRef.current) crankRef.current.rotation.z = angle;

    // Crank-slider kinematics: piston constrained to Y axis
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);
    const cpx = -R * sinA;
    const cpy = R * cosA;
    const pistonY = R * cosA + Math.sqrt(Math.max(0, L * L - R * R * sinA * sinA));

    if (pistonRef.current) pistonRef.current.position.y = pistonY;

    if (rodRef.current) {
      rodRef.current.position.set(cpx / 2, (cpy + pistonY) / 2, 0);
      rodRef.current.rotation.z = Math.atan2(cpx, pistonY - cpy);
    }

    // Stress-driven coloring: lerp from blue (sf=0) to red (sf=1)
    colorBuf.copy(STRESS_COLOR_LOW).lerp(STRESS_COLOR_HIGH, sf);

    crankMat.color.copy(colorBuf);
    crankMat.emissive.copy(colorBuf).multiplyScalar(0.12);

    colorBuf2.copy(colorBuf).lerp(STEEL, 0.4);
    rodMat.color.copy(colorBuf2);

    colorBuf2.copy(colorBuf).lerp(STEEL, 0.2);
    pistonMat.color.copy(colorBuf2);
    pistonMat.emissive.copy(colorBuf).multiplyScalar(0.06);
  });

  return (
    <group>
      {/* ── Crankshaft (rotates as a unit) ── */}
      <group ref={crankRef}>
        {/* Front main journal */}
        <mesh material={crankMat} position={[0, 0, JOURNAL_CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[JOURNAL_R, JOURNAL_R, JOURNAL_LEN, 32]} />
        </mesh>
        {/* Rear main journal */}
        <mesh material={crankMat} position={[0, 0, -JOURNAL_CENTER_Z]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[JOURNAL_R, JOURNAL_R, JOURNAL_LEN, 32]} />
        </mesh>

        {/* Crank pin (between webs, at throw radius) */}
        <mesh material={crankMat} position={[0, R, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[PIN_R, PIN_R, PIN_LEN, 24]} />
        </mesh>

        {/* Front web arm + counterweight */}
        <group position={[0, 0, WEB_CENTER_Z]}>
          <mesh material={crankMat} position={[0, R / 2, 0]}>
            <boxGeometry args={[JOURNAL_R * 2, R, WEB_THICK]} />
          </mesh>
          <mesh material={crankMat} position={[0, -CW_HEIGHT / 2, 0]}>
            <boxGeometry args={[CW_DEPTH, CW_HEIGHT, WEB_THICK]} />
          </mesh>
        </group>

        {/* Rear web arm + counterweight */}
        <group position={[0, 0, -WEB_CENTER_Z]}>
          <mesh material={crankMat} position={[0, R / 2, 0]}>
            <boxGeometry args={[JOURNAL_R * 2, R, WEB_THICK]} />
          </mesh>
          <mesh material={crankMat} position={[0, -CW_HEIGHT / 2, 0]}>
            <boxGeometry args={[CW_DEPTH, CW_HEIGHT, WEB_THICK]} />
          </mesh>
        </group>
      </group>

      {/* ── Connecting rod ── */}
      <group ref={rodRef}>
        <mesh material={rodMat}>
          <boxGeometry args={[0.065, L, 0.04]} />
        </mesh>
        {/* Big end bearing (crank side) */}
        <mesh material={rodMat} position={[0, -L / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[PIN_R + 0.015, 0.02, 12, 24]} />
        </mesh>
        {/* Small end bearing (piston side) */}
        <mesh material={rodMat} position={[0, L / 2, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.035, 0.015, 12, 24]} />
        </mesh>
      </group>

      {/* ── Piston ── */}
      {/* Group origin = wrist pin (where rod connects at bottom of piston) */}
      <group ref={pistonRef}>
        <mesh material={pistonMat} position={[0, PISTON_H / 2, 0]}>
          <cylinderGeometry args={[PISTON_R, PISTON_R, PISTON_H, 32]} />
        </mesh>
        {/* Wrist pin — at group origin (bottom of piston body) */}
        <mesh material={rodMat} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.03, 0.03, PISTON_R * 1.6, 16]} />
        </mesh>
      </group>

    </group>
  );
}

const BORE_CENTER_Y = L + PISTON_H / 2;

function EngineBlock() {
  const boreMat = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: 0x2a3a4a,
        transparent: true,
        opacity: 0.2,
        side: THREE.DoubleSide,
        metalness: 0.4,
        roughness: 0.5,
      }),
    [],
  );

  useEffect(() => {
    return () => { boreMat.dispose(); };
  }, [boreMat]);

  return (
    <mesh material={boreMat} position={[0, BORE_CENTER_Y, 0]}>
      <cylinderGeometry args={[BORE_R, BORE_R, BORE_H, 32, 1, true]} />
    </mesh>
  );
}

function ForceArrows() {
  const pistonShaftRef = useRef<THREE.Mesh>(null);
  const pistonHeadRef = useRef<THREE.Mesh>(null);
  const pistonGroupRef = useRef<THREE.Group>(null);

  const tangShaftRef = useRef<THREE.Mesh>(null);
  const tangHeadRef = useRef<THREE.Mesh>(null);
  const tangGroupRef = useRef<THREE.Group>(null);

  const sideShaftRef = useRef<THREE.Mesh>(null);
  const sideHeadRef = useRef<THREE.Mesh>(null);
  const sideGroupRef = useRef<THREE.Group>(null);

  const arrowMats = useMemo(() => ({
    piston: new THREE.MeshStandardMaterial({ color: 0xfbbf24, emissive: 0xfbbf24, emissiveIntensity: 0.6 }),
    tangential: new THREE.MeshStandardMaterial({ color: 0x22c55e, emissive: 0x22c55e, emissiveIntensity: 0.6 }),
    side: new THREE.MeshStandardMaterial({ color: 0xec4899, emissive: 0xec4899, emissiveIntensity: 0.6 }),
  }), []);

  useEffect(() => {
    return () => {
      arrowMats.piston.dispose();
      arrowMats.tangential.dispose();
      arrowMats.side.dispose();
    };
  }, [arrowMats]);

  const updateArrow = (
    groupRef: React.RefObject<THREE.Group | null>,
    shaftRef: React.RefObject<THREE.Mesh | null>,
    headRef: React.RefObject<THREE.Mesh | null>,
    x: number, y: number, rotZ: number, len: number, visible: boolean,
  ) => {
    if (groupRef.current) {
      groupRef.current.position.set(x, y, 0.18);
      groupRef.current.rotation.z = rotZ;
      groupRef.current.visible = visible;
    }
    if (shaftRef.current) {
      shaftRef.current.scale.y = len;
      shaftRef.current.position.y = len / 2;
    }
    if (headRef.current) {
      headRef.current.position.y = len + 0.06;
    }
  };

  useFrame(() => {
    const s = useTwinStore.getState().latest;
    const angle = s.angle_rad;
    const sinA = Math.sin(angle);
    const cosA = Math.cos(angle);

    const cpx = -R * sinA;
    const cpy = R * cosA;
    const pistonY = R * cosA + Math.sqrt(Math.max(0, L * L - R * R * sinA * sinA));

    // Piston inertia force (amber, vertical on piston)
    const pf = s.piston_force_n;
    const pfL = arrowLen(pf);
    updateArrow(
      pistonGroupRef, pistonShaftRef, pistonHeadRef,
      0, pistonY + PISTON_H,
      pf >= 0 ? 0 : Math.PI,
      pfL, Math.abs(pf) > 1,
    );

    // Tangential force (green, at crank pin, perpendicular to crank arm)
    const tf = s.tangential_force_n;
    const tfL = arrowLen(tf);
    const tangRot = angle + (tf >= 0 ? Math.PI / 2 : -Math.PI / 2);
    updateArrow(
      tangGroupRef, tangShaftRef, tangHeadRef,
      cpx, cpy,
      tangRot,
      tfL, Math.abs(tf) > 1,
    );

    // Side thrust (pink, horizontal on piston)
    const st = s.side_thrust_n;
    const stL = arrowLen(st);
    updateArrow(
      sideGroupRef, sideShaftRef, sideHeadRef,
      0, pistonY + PISTON_H * 0.3,
      st >= 0 ? -Math.PI / 2 : Math.PI / 2,
      stL, Math.abs(st) > 1,
    );
  });

  return (
    <group>
      {/* Piston force (amber) */}
      <group ref={pistonGroupRef}>
        <mesh ref={pistonShaftRef} material={arrowMats.piston}>
          <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
        </mesh>
        <mesh ref={pistonHeadRef} material={arrowMats.piston}>
          <coneGeometry args={[0.06, 0.12, 8]} />
        </mesh>
      </group>

      {/* Tangential force (green) */}
      <group ref={tangGroupRef}>
        <mesh ref={tangShaftRef} material={arrowMats.tangential}>
          <cylinderGeometry args={[0.025, 0.025, 1, 8]} />
        </mesh>
        <mesh ref={tangHeadRef} material={arrowMats.tangential}>
          <coneGeometry args={[0.06, 0.12, 8]} />
        </mesh>
      </group>

      {/* Side thrust (pink) */}
      <group ref={sideGroupRef}>
        <mesh ref={sideShaftRef} material={arrowMats.side}>
          <cylinderGeometry args={[0.02, 0.02, 1, 8]} />
        </mesh>
        <mesh ref={sideHeadRef} material={arrowMats.side}>
          <coneGeometry args={[0.05, 0.1, 8]} />
        </mesh>
      </group>
    </group>
  );
}

export default function Scene() {
  return (
    <div className="w-full h-full">
      <Canvas
        camera={{ position: [2.5, 2, 2.5], fov: 45 }}
        gl={{ antialias: true }}
      >
        <ambientLight intensity={0.4} />
        <directionalLight position={[5, 5, 5]} intensity={1} />
        <pointLight position={[-3, 2, -3]} intensity={0.5} color="#8b5cf6" />
        <EngineBlock />
        <CrankshaftWithPiston />
        <ForceArrows />
        <OrbitControls enableDamping dampingFactor={0.1} target={[0, 0.8, 0]} />
        <Environment preset="city" background={false} />
        <gridHelper args={[10, 20, '#1e293b', '#0f172a']} />
      </Canvas>
    </div>
  );
}
