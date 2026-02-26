'use client';

import { useState } from 'react';
import type { Measurement, MeasurementRegion } from '@/lib/types';
import { measurementLabels } from '@/lib/data/site';

interface BodyMapProps {
  measurements: Measurement;
  onRegionClick?: (region: MeasurementRegion) => void;
}

const regions: { id: MeasurementRegion; label: string; cx: number; cy: number }[] = [
  { id: 'neck', label: 'Neck', cx: 100, cy: 58 },
  { id: 'shoulders', label: 'Shoulders', cx: 100, cy: 75 },
  { id: 'chest', label: 'Chest', cx: 100, cy: 100 },
  { id: 'left_bicep', label: 'L. Bicep', cx: 52, cy: 110 },
  { id: 'right_bicep', label: 'R. Bicep', cx: 148, cy: 110 },
  { id: 'waist', label: 'Waist', cx: 100, cy: 140 },
  { id: 'hips', label: 'Hips', cx: 100, cy: 165 },
  { id: 'left_thigh', label: 'L. Thigh', cx: 78, cy: 210 },
  { id: 'right_thigh', label: 'R. Thigh', cx: 122, cy: 210 },
  { id: 'left_calf', label: 'L. Calf', cx: 78, cy: 290 },
  { id: 'right_calf', label: 'R. Calf', cx: 122, cy: 290 },
];

export function BodyMap({ measurements, onRegionClick }: BodyMapProps) {
  const [hoveredRegion, setHoveredRegion] = useState<MeasurementRegion | null>(null);

  const getValue = (region: MeasurementRegion): number | null => {
    const key = `${region}_cm` as keyof Measurement;
    return measurements[key] as number | null;
  };

  return (
    <div className="glass rounded-xl p-5">
      <svg viewBox="0 0 200 360" className="w-full max-w-[200px] mx-auto">
        {/* Simplified body outline */}
        <path
          d="M100,20 C90,20 85,28 85,38 L85,42 C85,48 90,52 95,52 L105,52 C110,52 115,48 115,42 L115,38 C115,28 110,20 100,20 Z M72,56 L60,100 L48,100 L40,145 L55,145 L58,125 L68,125 L75,160 L82,200 L78,250 L75,330 L90,330 L95,255 L100,230 L105,255 L110,330 L125,330 L122,250 L118,200 L125,160 L132,125 L142,125 L145,145 L160,145 L152,100 L140,100 L128,56 Z"
          fill="rgba(255,255,255,0.03)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1"
        />

        {/* Measurement points */}
        {regions.map((region) => {
          const value = getValue(region.id);
          const isHovered = hoveredRegion === region.id;

          return (
            <g
              key={region.id}
              onClick={() => onRegionClick?.(region.id)}
              onMouseEnter={() => setHoveredRegion(region.id)}
              onMouseLeave={() => setHoveredRegion(null)}
              className="cursor-pointer"
            >
              <circle
                cx={region.cx}
                cy={region.cy}
                r={isHovered ? 8 : 5}
                fill={value !== null ? '#00FF87' : 'rgba(255,255,255,0.2)'}
                opacity={isHovered ? 1 : 0.7}
                className="transition-all duration-200"
              />
              {isHovered && value !== null && (
                <>
                  <rect
                    x={region.cx - 30}
                    y={region.cy - 28}
                    width="60"
                    height="20"
                    rx="4"
                    fill="#1E1E2E"
                    stroke="rgba(255,255,255,0.1)"
                    strokeWidth="0.5"
                  />
                  <text
                    x={region.cx}
                    y={region.cy - 15}
                    textAnchor="middle"
                    fill="#F8FAFC"
                    fontSize="8"
                    fontFamily="monospace"
                  >
                    {value.toFixed(1)} cm
                  </text>
                </>
              )}
            </g>
          );
        })}
      </svg>
    </div>
  );
}
