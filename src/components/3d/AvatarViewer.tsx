'use client';

import { useRef, useMemo, useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, ContactShadows } from '@react-three/drei';
import * as THREE from 'three';

// SMPL body region vertex index ranges (approximate)
const BODY_REGIONS = {
  head:     { start: 0,    end: 500,   color: new THREE.Color('#D4B896') },
  neck:     { start: 500,  end: 700,   color: new THREE.Color('#D0B48E') },
  torso:    { start: 700,  end: 3200,  color: new THREE.Color('#C8A882') },
  leftArm:  { start: 3200, end: 4200,  color: new THREE.Color('#CCAC86') },
  rightArm: { start: 4200, end: 5200,  color: new THREE.Color('#CCAC86') },
  leftLeg:  { start: 5200, end: 6050,  color: new THREE.Color('#C4A47E') },
  rightLeg: { start: 6050, end: 6890,  color: new THREE.Color('#C4A47E') },
} as const;

const UNIFORM_BODY_COLOR = new THREE.Color('#C8A882');

interface MeasurementRing {
  region: string;
  circumference_cm: number;
  y_position?: number;
}

export interface AvatarViewerProps {
  vertices: number[];
  faces: number[];
  colorByRegion?: boolean;
  showMeasurements?: boolean;
  measurements?: MeasurementRing[];
  className?: string;
}

function BodyMesh({
  vertices,
  faces,
  colorByRegion,
}: {
  vertices: number[];
  faces: number[];
  colorByRegion: boolean;
}) {
  const meshRef = useRef<THREE.Mesh>(null);

  const geometry = useMemo(() => {
    const geo = new THREE.BufferGeometry();

    const positionArray = new Float32Array(vertices);
    geo.setAttribute('position', new THREE.BufferAttribute(positionArray, 3));

    const indexArray = new Uint32Array(faces);
    geo.setIndex(new THREE.BufferAttribute(indexArray, 1));

    geo.computeVertexNormals();

    if (colorByRegion) {
      const vertexCount = vertices.length / 3;
      const colors = new Float32Array(vertexCount * 3);

      for (let i = 0; i < vertexCount; i++) {
        let color = UNIFORM_BODY_COLOR;
        for (const region of Object.values(BODY_REGIONS)) {
          if (i >= region.start && i < region.end) {
            color = region.color;
            break;
          }
        }
        colors[i * 3] = color.r;
        colors[i * 3 + 1] = color.g;
        colors[i * 3 + 2] = color.b;
      }

      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    }

    // Center the mesh
    geo.computeBoundingBox();
    if (geo.boundingBox) {
      const center = new THREE.Vector3();
      geo.boundingBox.getCenter(center);
      geo.translate(-center.x, -center.y, -center.z);

      // Scale to fit nicely in view (~2 units tall)
      const size = new THREE.Vector3();
      geo.boundingBox.getSize(size);
      const maxDim = Math.max(size.x, size.y, size.z);
      if (maxDim > 0) {
        const scale = 2 / maxDim;
        geo.scale(scale, scale, scale);
      }
    }

    return geo;
  }, [vertices, faces, colorByRegion]);

  useEffect(() => {
    return () => {
      geometry.dispose();
    };
  }, [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry}>
      <meshStandardMaterial
        color={colorByRegion ? undefined : UNIFORM_BODY_COLOR}
        vertexColors={colorByRegion}
        roughness={0.6}
        metalness={0.1}
        side={THREE.DoubleSide}
      />
    </mesh>
  );
}

function MeasurementRings({
  measurements,
  vertices,
}: {
  measurements: MeasurementRing[];
  vertices: number[];
}) {
  const rings = useMemo(() => {
    if (!measurements || measurements.length === 0) return [];

    // Find mesh bounds to map y_position
    let minY = Infinity;
    let maxY = -Infinity;
    for (let i = 1; i < vertices.length; i += 3) {
      if (vertices[i] < minY) minY = vertices[i];
      if (vertices[i] > maxY) maxY = vertices[i];
    }
    const height = maxY - minY;
    if (height === 0) return [];

    return measurements
      .filter((m) => m.y_position !== undefined)
      .map((m) => {
        // Normalize y_position (0..1 range from bottom to top) to mesh coords
        const normalizedY = ((m.y_position! - minY) / height) * 2 - 1;
        // Estimate radius from circumference
        const radiusEstimate = (m.circumference_cm / (2 * Math.PI)) * (2 / (height || 1));
        return {
          ...m,
          y: normalizedY,
          radius: Math.max(radiusEstimate, 0.05),
        };
      });
  }, [measurements, vertices]);

  return (
    <>
      {rings.map((ring, i) => (
        <mesh key={i} position={[0, ring.y, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[ring.radius, 0.005, 8, 64]} />
          <meshBasicMaterial color="#00FF87" transparent opacity={0.8} />
        </mesh>
      ))}
    </>
  );
}

function Scene({
  vertices,
  faces,
  colorByRegion,
  showMeasurements,
  measurements,
}: {
  vertices: number[];
  faces: number[];
  colorByRegion: boolean;
  showMeasurements: boolean;
  measurements?: MeasurementRing[];
}) {
  return (
    <>
      <ambientLight intensity={0.4} />
      <directionalLight position={[3, 5, 4]} intensity={0.8} castShadow />
      <directionalLight position={[-2, 3, -3]} intensity={0.3} color="#8888ff" />

      <BodyMesh
        vertices={vertices}
        faces={faces}
        colorByRegion={colorByRegion}
      />

      {showMeasurements && measurements && (
        <MeasurementRings measurements={measurements} vertices={vertices} />
      )}

      <ContactShadows
        position={[0, -1.1, 0]}
        opacity={0.4}
        scale={5}
        blur={2}
        far={4}
      />

      <OrbitControls
        enablePan={false}
        enableZoom={true}
        enableRotate={true}
        minDistance={1.5}
        maxDistance={6}
        target={[0, 0, 0]}
      />
    </>
  );
}

function LoadingSpinner() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-2 border-white/10 border-t-[#00FF87] rounded-full animate-spin" />
        <span className="text-sm text-[#94A3B8] font-[family-name:var(--font-body)]">
          Loading mesh...
        </span>
      </div>
    </div>
  );
}

function ErrorMessage({ message }: { message: string }) {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <div className="glass rounded-lg px-4 py-3 max-w-xs text-center">
        <p className="text-sm text-[#EF4444]">{message}</p>
      </div>
    </div>
  );
}

export function AvatarViewer({
  vertices,
  faces,
  colorByRegion = false,
  showMeasurements = false,
  measurements,
  className = '',
}: AvatarViewerProps) {
  const [ready, setReady] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Validate input data
    if (!vertices || vertices.length === 0) {
      setError('No vertex data provided');
      setReady(false);
      return;
    }
    if (vertices.length % 3 !== 0) {
      setError('Invalid vertex data: length must be divisible by 3');
      setReady(false);
      return;
    }
    if (!faces || faces.length === 0) {
      setError('No face data provided');
      setReady(false);
      return;
    }
    if (faces.length % 3 !== 0) {
      setError('Invalid face data: length must be divisible by 3');
      setReady(false);
      return;
    }

    setError(null);
    // Small delay so spinner is visible, then render
    const timer = setTimeout(() => setReady(true), 50);
    return () => clearTimeout(timer);
  }, [vertices, faces]);

  return (
    <div className={`relative w-full h-full min-h-[300px] ${className}`}>
      {error ? (
        <ErrorMessage message={error} />
      ) : !ready ? (
        <LoadingSpinner />
      ) : (
        <Canvas
          camera={{ position: [0, 0.5, 3], fov: 45 }}
          gl={{ alpha: true, antialias: true }}
          style={{ background: 'transparent' }}
          onCreated={(state) => {
            state.gl.toneMapping = THREE.ACESFilmicToneMapping;
            state.gl.toneMappingExposure = 1.2;
          }}
        >
          <Scene
            vertices={vertices}
            faces={faces}
            colorByRegion={colorByRegion}
            showMeasurements={showMeasurements}
            measurements={measurements}
          />
        </Canvas>
      )}
    </div>
  );
}
