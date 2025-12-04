"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { Environment, Float, Sparkles } from "@react-three/drei";
import * as THREE from "three";

const ANIMATION_DURATION = 8;

function createRandom(seed: number) {
  let value = seed % 2147483647;
  if (value <= 0) {
    value += 2147483646;
  }
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

type SceneContentProps = {
  onProgress: (value: number) => void;
};

function SceneContent({ onProgress }: SceneContentProps) {
  const jaxRef = useRef<THREE.Group>(null);
  const ninoRef = useRef<THREE.Group>(null);
  const toolBagRef = useRef<THREE.Group>(null);
  const cachedProgressRef = useRef(0);
  const startTimeRef = useRef<number | null>(null);
  const lookAhead = useMemo(() => new THREE.Vector3(), []);
  const tangent = useMemo(() => new THREE.Vector3(), []);
  const cameraTarget = useMemo(() => new THREE.Vector3(), []);
  const offset = useMemo(() => new THREE.Vector3(-1.25, 0.62, 1.4), []);
  const basisMatrix = useMemo(() => new THREE.Matrix4(), []);

  const curve = useMemo(
    () =>
      new THREE.CatmullRomCurve3(
        [
          new THREE.Vector3(-5.3, 0.12, 3.1),
          new THREE.Vector3(-2.3, 0.08, 1.4),
          new THREE.Vector3(0.4, 0.06, 0.3),
          new THREE.Vector3(3.1, 0.05, -0.6),
          new THREE.Vector3(6.2, 0.04, -1.5),
        ],
        false,
        "catmullrom",
        0.5,
      ),
    [],
  );

  useFrame((state, delta) => {
    if (startTimeRef.current === null) {
      startTimeRef.current = state.clock.elapsedTime;
    }

    const elapsed = state.clock.elapsedTime - startTimeRef.current;
    const raw = THREE.MathUtils.clamp(elapsed / ANIMATION_DURATION, 0, 1);
    const eased = THREE.MathUtils.smootherstep(raw, 0, 1);

    if (Math.abs(cachedProgressRef.current - eased) > 0.001) {
      cachedProgressRef.current = eased;
      onProgress(eased);
    }

    const jaxProgress = eased;
    const ninoProgress = Math.min(Math.max(eased - 0.16, 0) * 0.94, 0.98);

    const jaxPosition = curve.getPointAt(jaxProgress);
    const ninoPosition = curve.getPointAt(ninoProgress);
    curve.getTangentAt(jaxProgress, tangent).normalize();

    if (jaxRef.current) {
      jaxRef.current.position.copy(jaxPosition);
      lookAhead.copy(jaxPosition).addScaledVector(tangent, 0.8);
      jaxRef.current.lookAt(lookAhead);
      jaxRef.current.rotation.y += Math.sin(elapsed * 12) * 0.02;
      jaxRef.current.position.y += Math.sin(elapsed * 6) * 0.024;
    }

    if (ninoRef.current) {
      ninoRef.current.position.copy(ninoPosition);
      ninoRef.current.position.y += 0.16 + Math.sin(elapsed * 7 + 1.8) * 0.05;
      ninoRef.current.rotation.y = Math.atan2(tangent.x, tangent.z) + Math.sin(elapsed * 8) * 0.18;
      ninoRef.current.rotation.z = Math.sin(elapsed * 10) * 0.12;
    }

    if (toolBagRef.current) {
      toolBagRef.current.rotation.z = Math.sin(elapsed * 12) * 0.28 + THREE.MathUtils.lerp(0.7, 0.08, eased);
      toolBagRef.current.position.set(-0.22, 0.25, -0.14);
    }

    const camera = state.camera;
    cameraTarget.copy(jaxPosition).add(new THREE.Vector3(0, 0.45, 0));
    basisMatrix.lookAt(new THREE.Vector3(0, 0, 0), tangent, new THREE.Vector3(0, 1, 0));
    const desired = jaxPosition.clone().add(offset.clone().applyMatrix4(basisMatrix));
    camera.position.lerp(desired, 1 - Math.pow(0.0001, delta));
    camera.lookAt(cameraTarget);
  });

  return (
    <group>
      <color attach="background" args={["#0d1629"]} />
      <fog attach="fog" args={["#0d1629", 10, 28]} />
      <Environment preset="sunset" environmentIntensity={0.65} />
      <SunLight />
      <Ground />
      <GrassField />
      <StoneScatter />
      <MiniTrees />
      <Road curve={curve} />
      <Float speed={1.2} rotationIntensity={0.08} floatIntensity={0.12}>
        <group ref={jaxRef}>
          <Jax />
        </group>
      </Float>
      <group ref={ninoRef}>
        <Nino />
        <group ref={toolBagRef}>
          <ToolBag />
        </group>
      </group>
      <DustEmitter followRef={jaxRef} />
      <Sparkles
        count={110}
        speed={0.12}
        opacity={0.45}
        color="#ffd9a3"
        scale={[11, 3, 11]}
        position={[0, 2.4, 0]}
        size={4}
      />
    </group>
  );
}

const ROAD_WIDTH = 0.9;

function Road({ curve }: { curve: THREE.CatmullRomCurve3 }) {
  const geometry = useMemo(() => {
    const divisions = 90;
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];

    for (let i = 0; i < divisions; i++) {
      const t = i / (divisions - 1);
      const current = curve.getPointAt(t);
      const next = curve.getPointAt(Math.min(t + 1 / (divisions - 1), 1));
      const dir = next.clone().sub(current).normalize();
      const right = new THREE.Vector3(dir.z, 0, -dir.x).normalize().multiplyScalar(ROAD_WIDTH);

      const tl = current.clone().add(right);
      const bl = current.clone().sub(right);
      const tr = next.clone().add(right);
      const br = next.clone().sub(right);

      vertices.push(
        tl.x,
        tl.y + 0.002,
        tl.z,
        bl.x,
        bl.y + 0.002,
        bl.z,
        br.x,
        br.y + 0.002,
        br.z,
        tl.x,
        tl.y + 0.002,
        tl.z,
        br.x,
        br.y + 0.002,
        br.z,
        tr.x,
        tr.y + 0.002,
        tr.z,
      );

      for (let face = 0; face < 6; face++) {
        normals.push(0, 1, 0);
      }

      uvs.push(
        1, 0,
        0, 0,
        0, 1,
        1, 0,
        0, 1,
        1, 1,
      );
    }

    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
    buffer.setAttribute("normal", new THREE.Float32BufferAttribute(normals, 3));
    buffer.setAttribute("uv", new THREE.Float32BufferAttribute(uvs, 2));
    buffer.computeVertexNormals();
    return buffer;
  }, [curve]);

  useEffect(() => () => geometry.dispose(), [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial color="#3f2d24" roughness={0.9} metalness={0.08} envMapIntensity={0.17} />
    </mesh>
  );
}

function Ground() {
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]}>
      <circleGeometry args={[18, 64]} />
      <meshStandardMaterial color="#1b2a1f" roughness={0.95} metalness={0.04} />
    </mesh>
  );
}

function GrassField() {
  const instances = 600;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const geometry = useMemo(() => new THREE.ConeGeometry(0.05, 0.32, 5), []);
  const material = useMemo(
    () =>
      new THREE.MeshStandardMaterial({
        color: "#2e5f2b",
        roughness: 0.8,
        metalness: 0.1,
      }),
    [],
  );

  useEffect(() => {
    if (!meshRef.current) {
      return;
    }

    const dummy = new THREE.Object3D();
    const radius = 7.3;
    const rand = createRandom(42);
    let filled = 0;
    while (filled < instances) {
      const angle = rand() * Math.PI * 2;
      const dist = rand() * radius;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (Math.abs(z) < 1.1 && x > -5.5 && x < 6.4) {
        continue;
      }
      dummy.position.set(x, 0.07, z);
      const scale = 0.6 + rand() * 0.8;
      dummy.scale.set(scale * 0.8, scale, scale * 0.8);
      dummy.rotation.y = rand() * Math.PI;
      dummy.updateMatrix();
      meshRef.current.setMatrixAt(filled, dummy.matrix);
      filled++;
    }
    meshRef.current.instanceMatrix.needsUpdate = true;
  }, [instances]);

  useFrame(({ clock }) => {
    if (!meshRef.current) {
      return;
    }
    const t = clock.getElapsedTime();
    meshRef.current.rotation.y = Math.sin(t * 1.6) * 0.08;
  });

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  return <instancedMesh ref={meshRef} args={[geometry, material, instances]} />;
}

function StoneScatter() {
  const stones = useMemo(() => {
    const count = 80;
    const rand = createRandom(77);
    const list: Array<{ position: [number, number, number]; scale: number }> = [];
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 1.6 + rand() * 6.5;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      if (Math.abs(z) < 0.9 && x > -4.5 && x < 5.7) {
        continue;
      }
      list.push({
        position: [x, 0.05, z],
        scale: 0.18 + rand() * 0.32,
      });
    }
    return list;
  }, []);

  return (
    <group>
      {stones.map((stone, index) => (
        <mesh key={index} position={stone.position}>
          <icosahedronGeometry args={[stone.scale, 0]} />
          <meshStandardMaterial color="#65584b" roughness={0.92} metalness={0.12} />
        </mesh>
      ))}
    </group>
  );
}

function MiniTrees() {
  const trees = useMemo(() => {
    const placements: Array<{ position: [number, number, number]; scale: number }> = [];
    const count = 28;
    const rand = createRandom(1337);
    for (let i = 0; i < count; i++) {
      const angle = rand() * Math.PI * 2;
      const dist = 4.3 + rand() * 2.8;
      const x = Math.cos(angle) * dist;
      const z = Math.sin(angle) * dist;
      placements.push({
        position: [x, 0, z],
        scale: 0.6 + rand() * 0.9,
      });
    }
    return placements;
  }, []);

  return (
    <group>
      {trees.map((tree, index) => (
        <group key={index} position={tree.position} scale={tree.scale}>
          <mesh position={[0, 0.4, 0]}>
            <cylinderGeometry args={[0.06, 0.1, 0.8, 6]} />
            <meshStandardMaterial color="#6c4631" roughness={0.8} />
          </mesh>
          <mesh position={[0, 1, 0]}>
            <coneGeometry args={[0.7, 1.2, 7]} />
            <meshStandardMaterial color="#305729" roughness={0.68} />
          </mesh>
        </group>
      ))}
    </group>
  );
}

function SunLight() {
  return (
    <group>
      <hemisphereLight args={["#ffe1b0", "#132420", 0.6]} />
      <directionalLight position={[6, 7, 2]} intensity={1.4} color="#ffedca" />
      <directionalLight position={[-4, 6, -3]} intensity={0.35} color="#426ba4" />
    </group>
  );
}

function Jax() {
  return (
    <group>
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[0.9, 0.34, 0.6]} />
        <meshStandardMaterial color="#d7263d" roughness={0.4} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.47, 0]}>
        <boxGeometry args={[0.78, 0.32, 0.54]} />
        <meshStandardMaterial color="#f04755" roughness={0.35} metalness={0.55} />
      </mesh>
      <mesh position={[0.35, 0.42, 0]} rotation={[0, 0, 0.06]}>
        <planeGeometry args={[0.3, 0.14]} />
        <meshStandardMaterial color="#312723" roughness={0.85} />
      </mesh>
      <Wheel position={[-0.32, 0.09, 0.32]} />
      <Wheel position={[0.32, 0.09, 0.32]} />
      <Wheel position={[-0.32, 0.09, -0.32]} />
      <Wheel position={[0.32, 0.09, -0.32]} />
      <mesh position={[0.4, 0.4, 0.18]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color="#ffe5b5" emissive="#f8d492" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.4, 0.4, -0.18]}>
        <sphereGeometry args={[0.08, 24, 24]} />
        <meshStandardMaterial color="#ffe5b5" emissive="#f8d492" emissiveIntensity={0.4} />
      </mesh>
      <mesh position={[0.15, 0.2, -0.27]} rotation={[0, 0, 0.28]}>
        <boxGeometry args={[0.24, 0.1, 0.1]} />
        <meshStandardMaterial color="#6b2d23" roughness={0.85} />
      </mesh>
      <mesh position={[-0.4, 0.22, 0.18]} rotation={[0, 0, 0.12]}>
        <boxGeometry args={[0.12, 0.18, 0.58]} />
        <meshStandardMaterial color="#6b0b13" roughness={0.6} metalness={0.35} />
      </mesh>
      <AnimatedEyes />
    </group>
  );
}

function AnimatedEyes() {
  const leftEye = useRef<THREE.Mesh>(null);
  const rightEye = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const blink = Math.max(0.12, Math.abs(Math.sin(clock.getElapsedTime() * 1.4)));
    const tilt = Math.sin(clock.getElapsedTime() * 2.2) * 0.08;
    if (leftEye.current && rightEye.current) {
      leftEye.current.scale.y = blink;
      rightEye.current.scale.y = blink;
      leftEye.current.position.y = 0.4 + tilt * 0.05;
      rightEye.current.position.y = 0.4 - tilt * 0.05;
    }
  });

  return (
    <group>
      <mesh ref={leftEye} position={[0.38, 0.4, 0.15]}>
        <planeGeometry args={[0.12, 0.12]} />
        <meshStandardMaterial color="#1d1d1d" emissive="#0c0c0c" emissiveIntensity={0.8} />
      </mesh>
      <mesh ref={rightEye} position={[0.38, 0.4, -0.15]}>
        <planeGeometry args={[0.12, 0.12]} />
        <meshStandardMaterial color="#1d1d1d" emissive="#0c0c0c" emissiveIntensity={0.8} />
      </mesh>
    </group>
  );
}

function Wheel({ position }: { position: [number, number, number] }) {
  const wheelRef = useRef<THREE.Mesh>(null);
  useFrame((_, delta) => {
    if (wheelRef.current) {
      wheelRef.current.rotation.x -= delta * 22;
    }
  });

  return (
    <mesh ref={wheelRef} position={position}>
      <torusGeometry args={[0.14, 0.06, 12, 24]} />
      <meshStandardMaterial color="#1d1d1d" roughness={0.92} metalness={0.1} />
    </mesh>
  );
}

function Nino() {
  return (
    <group scale={0.82}>
      <mesh position={[0, 0.35, 0]}>
        <cylinderGeometry args={[0.18, 0.18, 0.5, 16]} />
        <meshStandardMaterial color="#2c70c9" roughness={0.45} metalness={0.6} />
      </mesh>
      <mesh position={[0, 0.7, 0]}>
        <sphereGeometry args={[0.22, 24, 24]} />
        <meshStandardMaterial color="#58a7f4" roughness={0.35} metalness={0.65} />
      </mesh>
      <mesh position={[0.11, 0.7, 0.12]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#0d1629" emissive="#0a2e4f" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[-0.11, 0.7, 0.12]}>
        <sphereGeometry args={[0.05, 16, 16]} />
        <meshStandardMaterial color="#0d1629" emissive="#0a2e4f" emissiveIntensity={0.85} />
      </mesh>
      <mesh position={[0, 0.88, 0]}>
        <cylinderGeometry args={[0.06, 0.08, 0.18, 8]} />
        <meshStandardMaterial color="#8ec9ff" roughness={0.4} metalness={0.5} />
      </mesh>
      <mesh position={[0, 0.95, 0]}>
        <sphereGeometry args={[0.05, 12, 12]} />
        <meshStandardMaterial color="#b8e0ff" emissive="#86c7ff" emissiveIntensity={0.7} />
      </mesh>
      <mesh position={[0.25, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 12]} />
        <meshStandardMaterial color="#7ab4f5" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[-0.25, 0.35, 0]}>
        <cylinderGeometry args={[0.04, 0.04, 0.3, 12]} />
        <meshStandardMaterial color="#7ab4f5" roughness={0.5} metalness={0.6} />
      </mesh>
      <mesh position={[0.25, 0.22, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#0c1635" roughness={0.58} metalness={0.35} />
      </mesh>
      <mesh position={[-0.25, 0.22, 0]}>
        <sphereGeometry args={[0.06, 16, 16]} />
        <meshStandardMaterial color="#0c1635" roughness={0.58} metalness={0.35} />
      </mesh>
    </group>
  );
}

function ToolBag() {
  return (
    <group>
      <mesh>
        <boxGeometry args={[0.34, 0.2, 0.18]} />
        <meshStandardMaterial color="#c99348" roughness={0.7} metalness={0.35} />
      </mesh>
      <mesh position={[0, 0.16, 0]}>
        <torusGeometry args={[0.12, 0.03, 16, 32]} />
        <meshStandardMaterial color="#8d5a1c" roughness={0.6} metalness={0.22} />
      </mesh>
      <mesh position={[0, 0.07, 0.12]}>
        <boxGeometry args={[0.26, 0.12, 0.04]} />
        <meshStandardMaterial color="#d3a060" roughness={0.8} />
      </mesh>
      <mesh position={[0.12, 0.07, 0]}>
        <boxGeometry args={[0.04, 0.14, 0.12]} />
        <meshStandardMaterial color="#a16a24" roughness={0.6} />
      </mesh>
      <mesh position={[-0.12, 0.07, 0]}>
        <boxGeometry args={[0.04, 0.14, 0.12]} />
        <meshStandardMaterial color="#a16a24" roughness={0.6} />
      </mesh>
    </group>
  );
}

function DustEmitter({ followRef }: { followRef: React.RefObject<THREE.Group | null> }) {
  const pointsRef = useRef<THREE.Points>(null);
  const geometry = useMemo(() => {
    const count = 70;
    const rand = createRandom(99);
    const positions = new Float32Array(count * 3);
    const sizes = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (rand() - 0.5) * 0.6;
      positions[i * 3 + 1] = rand() * 0.2;
      positions[i * 3 + 2] = (rand() - 0.5) * 0.6;
      sizes[i] = 0.6 + rand() * 0.4;
    }
    const buffer = new THREE.BufferGeometry();
    buffer.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    buffer.setAttribute("size", new THREE.BufferAttribute(sizes, 1));
    return buffer;
  }, []);

  const material = useMemo(
    () =>
      new THREE.PointsMaterial({
        color: "#f1d7b4",
        transparent: true,
        opacity: 0.55,
        size: 0.16,
        sizeAttenuation: true,
        depthWrite: false,
      }),
    [],
  );

  useEffect(
    () => () => {
      geometry.dispose();
      material.dispose();
    },
    [geometry, material],
  );

  useFrame(({ clock }) => {
    if (!pointsRef.current || !followRef.current) {
      return;
    }
    const base = followRef.current.position;
    const t = clock.getElapsedTime();
    pointsRef.current.position.set(base.x - 0.2, base.y + 0.05, base.z + 0.08);
    pointsRef.current.rotation.y = Math.sin(t * 0.6) * 0.3;
  });

  return <points ref={pointsRef} geometry={geometry} material={material} />;
}

function SceneOverlay({ progress }: { progress: number }) {
  const jaxActive = progress < 0.5;
  const speaker = jaxActive ? "JAX" : "NINO";
  const dialogue = jaxActive
    ? "Come on, Nino! If you're slow, we won’t make it!"
    : "Wait! This bag is too heavy!";

  return (
    <div className="overlay">
      <div className={`speech ${jaxActive ? "left" : "right"}`}>
        <span className="label">{speaker}</span>
        <span className="line">{dialogue}</span>
      </div>
      <style jsx>{`
        .overlay {
          position: absolute;
          inset: 0;
          display: flex;
          align-items: flex-end;
          justify-content: space-between;
          padding: 1.4rem 1.6rem;
          pointer-events: none;
        }

        .speech {
          padding: 1rem 1.4rem;
          border-radius: 18px;
          max-width: min(320px, 60%);
          background: rgba(7, 11, 24, 0.68);
          border: 1px solid rgba(255, 255, 255, 0.12);
          color: #fdf7f1;
          box-shadow: 0 12px 32px rgba(6, 12, 26, 0.4);
          backdrop-filter: blur(12px);
        }

        .speech.left {
          align-self: flex-start;
        }

        .speech.right {
          align-self: flex-end;
          margin-left: auto;
        }

        .label {
          display: block;
          font-size: 0.68rem;
          letter-spacing: 0.16em;
          text-transform: uppercase;
          color: rgba(255, 205, 150, 0.9);
          margin-bottom: 0.3rem;
        }

        .line {
          font-size: 1rem;
          line-height: 1.5;
        }

        @media (max-width: 640px) {
          .overlay {
            padding: 1.1rem 1rem;
          }

          .speech {
            max-width: min(260px, 70%);
          }

          .line {
            font-size: 0.9rem;
          }
        }
      `}</style>
    </div>
  );
}

export default function SceneCanvas() {
  const [progress, setProgress] = useState(0);
  const handleProgress = useCallback((value: number) => {
    setProgress(value);
  }, []);

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <Canvas dpr={[1, 1.5]} camera={{ position: [-4, 1.2, 4], fov: 45, near: 0.1, far: 100 }}>
        <SceneContent onProgress={handleProgress} />
      </Canvas>
      <SceneOverlay progress={progress} />
    </div>
  );
}
