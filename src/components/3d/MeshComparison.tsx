'use client';

import { useRef, useMemo, useEffect, useState } from 'react';
import { Canvas, useThree } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

const BODY_COLOR = new THREE.Color('#C8A882');

interface MeshData {
  vertices: number[];
  faces: number[];
  label: string;
  date: string;
}

export interface MeshComparisonProps {
  meshA: MeshData;
  meshB: MeshData;
  className?: string;
}

function ComparisonMesh({
  vertices,
  faces,
  diffColors,
}: {
  vertices: number[];
  faces: number[];
  diffColors?: Float32Array | null;
}) {
  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positionArray = new Float32Array(vertices);
    geo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

    const indexArray = new Uint32Array(faces);
    geo.setIndex(new THREE.BufferAttribute(indexArray, 1));

    geo.computeVertexNormals();

    if (diffColors) {
      geo.setAttribute('color', new THREE.BufferAttribute(diffColors, 3));
    }

    // Center and normalize scale
    geo.computeBoundingBox();
    if (geo.boundingBox) {
      const center = new THREE.Vector3();
      geo.boundingBox.getCenter(center);
      geo.translate(-center.x, -center.y, -center.z);

      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 2 / maxDim;
        geo.scale(scale, scale, scale);
      }
    }

    return geo;
  }, [vertices, faces, diffColors]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh geometry={geometry}>
      <meshStandardMaterial
        color={diffColors ? undefined : BODY_COLOR}
        vertexColors={!!diffColors}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

/**
 * Compute per-vertex color based on distance difference between two meshes.
 * Red = grew (meshB vertex moved outward), Blue = shrunk.
 * Returns colors for meshB (the "after" mesh).
 */
function computeDiffColors(
  verticesA: number[],
  verticesB: number[]
): Float32Array | null {
  const countA = verticesA.length / 3;
  const countB = verticesB.length / 3;
  if (countA !== countB || countA === 0) return null;

  const colors = new Float32Array(countB * 3);

  // Compute center of mass for each mesh to determine "outward" direction
  const centerA = new THREE.Vector3();
  const centerB = new THREE.Vector3();
  for (let i = 0; i < countA; i++) {
    centerA.x += verticesA[i * 3];
    centerA.y += verticesA[i * 3 + 1];
    centerA.z += verticesA[i * 3 + 2];
    centerB.x += verticesB[i * 3];
    centerB.y += verticesB[i * 3 + 1];
    centerB.z += verticesB[i * 3 + 2];
  }
  centerA.divideScalar(countA);
  centerB.divideScalar(countB);

  // Compute max displacement for normalization
  let maxDisp = 0;
  const displacements = new Float32Array(countA);
  const dirA = new THREE.Vector3();
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();

  for (let i = 0; i < countA; i++) {
    posA.set(verticesA[i * 3], verticesA[i * 3 + 1], verticesA[i * 3 + 2]);
    posB.set(verticesB[i * 3], verticesB[i * 3 + 1], verticesB[i * 3 + 2]);

    // Direction from center to vertex (outward direction)
    dirA.copy(posA).sub(centerA).normalize();

    // Displacement along outward direction (positive = grew)
    const diff = posB.clone().sub(posA);
    displacements[i] = diff.dot(dirA);

    const absDist = Math.abs(displacements[i]);
    if (absDist > maxDisp) maxDisp = absDist;
  }

  if (maxDisp === 0) {
    // No difference — neutral gray
    for (let i = 0; i < countB; i++) {
      colors[i * 3] = BODY_COLOR.r;
      colors[i * 3 + 1] = BODY_COLOR.g;
      colors[i * 3 + 2] = BODY_COLOR.b;
    }
    return colors;
  }

  const neutral = BODY_COLOR;
  const grewColor = new THREE.Color('#EF4444');   // red
  const shrunkColor = new THREE.Color('#3B82F6');  // blue

  for (let i = 0; i < countB; i++) {
    const t = displacements[i] / maxDisp; // -1..1
    const absT = Math.min(Math.abs(t), 1);
    const blendColor = t > 0 ? grewColor : shrunkColor;

    colors[i * 3] = THREE.MathUtils.lerp(neutral.r, blendColor.r, absT);
    colors[i * 3 + 1] = THREE.MathUtils.lerp(neutral.g, blendColor.g, absT);
    colors[i * 3 + 2] = THREE.MathUtils.lerp(neutral.b, blendColor.b, absT);
  }

  return colors;
}

function SyncedControls({
  syncRef,
}: {
  syncRef: React.MutableRefObject<{ azimuth: number; polar: number; distance: number }>;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  useEffect(() => {
    const controls = controlsRef.current;
    if (!controls) return;

    const onUpdate = () => {
      syncRef.current = {
        azimuth: controls.getAzimuthalAngle(),
        polar: controls.getPolarAngle(),
        distance: camera.position.distanceTo(controls.target),
      };
    };

    controls.addEventListener('change', onUpdate);
    return () => controls.removeEventListener('change', onUpdate);
  }, [camera, syncRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={true}
      enableRotate={true}
      minDistance={1.5}
      maxDistance={6}
      target={[0, 0, 0]}
    />
  );
}

function FollowerControls({
  syncRef,
}: {
  syncRef: React.MutableRefObject<{ azimuth: number; polar: number; distance: number }>;
}) {
  const controlsRef = useRef<any>(null);
  const { camera } = useThree();

  // Sync to leader on each frame
  useEffect(() => {
    let frameId: number;

    const sync = () => {
      const controls = controlsRef.current;
      if (controls && syncRef.current) {
        const { azimuth, polar, distance } = syncRef.current;
        // Position camera in spherical coordinates
        const x = distance * Math.sin(polar) * Math.sin(azimuth);
        const y = distance * Math.cos(polar);
        const z = distance * Math.sin(polar) * Math.cos(azimuth);
        camera.position.set(x, y, z);
        camera.lookAt(0, 0, 0);
      }
      frameId = requestAnimationFrame(sync);
    };
    frameId = requestAnimationFrame(sync);

    return () => cancelAnimationFrame(frameId);
  }, [camera, syncRef]);

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      enableZoom={false}
      enableRotate={false}
      target={[0, 0, 0]}
    />
  );
}

function ComparisonScene({
  mesh,
  diffColors,
  isLeader,
  syncRef,
}: {
  mesh: MeshData;
  diffColors?: Float32Array | null;
  isLeader: boolean;
  syncRef: React.MutableRefObject<{ azimuth: number; polar: number; distance: number }>;
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} />
      <directionalLight position={[-2, 3, -3]} intensity={0.3} color="#8888ff" />

      <ComparisonMesh
        vertices={mesh.vertices}
        faces={mesh.faces}
        diffColors={diffColors}
      />

      <ContactShadows
        position={[0, -1.1, 0]}
        opacity={0.4}
        scale={5}
        blur={2}
        far={4}
      />

      {isLeader ? (
        <SyncedControls syncRef={syncRef} />
      ) : (
        <FollowerControls syncRef={syncRef} />
      )}
    </>
  );
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00FF87] rounded-full animate-spin" />
        <span className="text-sm text-[#94A3B8]">Loading meshes...</span>
      </div>
    </div>
  );
}

export function MeshComparison({
  meshA,
  meshB,
  className = '',
}: MeshComparisonProps) {
  const syncRef = useRef({ azimuth: 0, polar: Math.PI / 2, distance: 3 });
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Diff colors for meshB
  const diffColors = useMemo(() => {
    if (
      meshA.vertices.length === meshB.vertices.length &&
      meshA.vertices.length > 0
    ) {
      return computeDiffColors(meshA.vertices, meshB.vertices);
    }
    return null;
  }, [meshA.vertices, meshB.vertices]);

  useEffect(() => {
    if (
      !meshA.vertices.length ||
      !meshA.faces.length ||
      !meshB.vertices.length ||
      !meshB.faces.length
    ) {
      setError('Invalid mesh data');
      return;
    }
    setError(null);
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, [meshA, meshB]);

  if (error) {
    return (
      <div className={`glass rounded-xl p-6 text-center ${className}`}>
        <p className="text-sm text-[#EF4444]">{error}</p>
      </div>
    );
  }

  if (!ready) {
    return (
      <div className={`relative min-h-[400px] ${className}`}>
        <LoadingSpinner />
      </div>
    );
  }

  return (
    <div className={`flex flex-col gap-4 ${className}`}>
      {/* Legend */}
      <div className="flex items-center justify-center gap-6 text-xs text-[#94A3B8]">
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#3B82F6]" />
          <span>Shrunk</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#C8A882]" />
          <span>No change</span>
        </div>
        <div className="flex items-center gap-1.5">
          <div className="w-3 h-3 rounded-full bg-[#EF4444]" />
          <span>Grew</span>
        </div>
      </div>

      {/* Side-by-side canvases */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Mesh A — Before */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#F8FAFC]">
              {meshA.label || 'Before'}
            </span>
            <span className="ml-2 text-xs text-[#64748B]">{meshA.date}</span>
          </div>
          <div className="h-[350px] md:h-[450px]">
            <Canvas
              camera={{ position: [0, 0.5, 3], fov: 45 }}
              gl={{ alpha: true, antialias: true }}
              style={{ background: 'transparent' }}
              onCreated={(state) => {
                state.gl.toneMapping = THREE.ACESFilmicToneMapping;
                state.gl.toneMappingExposure = 1.2;
              }}
            >
              <ComparisonScene
                mesh={meshA}
                isLeader={true}
                syncRef={syncRef}
              />
            </Canvas>
          </div>
        </div>

        {/* Mesh B — After (with diff colors) */}
        <div className="glass rounded-xl overflow-hidden">
          <div className="px-4 py-2 border-b border-white/5">
            <span className="font-[family-name:var(--font-display)] text-sm font-semibold text-[#F8FAFC]">
              {meshB.label || 'After'}
            </span>
            <span className="ml-2 text-xs text-[#64748B]">{meshB.date}</span>
          </div>
          <div className="h-[350px] md:h-[450px]">
            <Canvas
              camera={{ position: [0, 0.5, 3], fov: 45 }}
              gl={{ alpha: true, antialias: true }}
              style={{ background: 'transparent' }}
              onCreated={(state) => {
                state.gl.toneMapping = THREE.ACESFilmicToneMapping;
                state.gl.toneMappingExposure = 1.2;
              }}
            >
              <ComparisonScene
                mesh={meshB}
                diffColors={diffColors}
                isLeader={false}
                syncRef={syncRef}
              />
            </Canvas>
          </div>
        </div>
      </div>
    </div>
  );
}
