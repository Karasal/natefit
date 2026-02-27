'use client';

import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { ScanResult, CalibrationData } from '@/lib/types';
import { measurementLabels } from '@/lib/data/site';
import { AvatarViewer } from '@/components/3d/AvatarViewer';
import { Activity, Box, Droplets, Flame, Scale, TrendingUp } from 'lucide-react';

interface ScanResultsProps {
  result: ScanResult;
  calibration: CalibrationData;
}

export function ScanResults({ result, calibration }: ScanResultsProps) {
  const { circumferences, composition, confidence_score } = result;

  const confidenceVariant =
    confidence_score >= 0.8 ? 'neon' : confidence_score >= 0.6 ? 'electric' : 'hot';

  const isLidar = result.scan_tier === 'lidar';

  return (
    <div className="max-w-2xl mx-auto p-4 space-y-6">
      {/* Header */}
      <div className="text-center">
        <h2 className="font-display text-3xl font-bold mb-2">Scan Complete</h2>
        <div className="flex items-center justify-center gap-2">
          <Badge variant={isLidar ? 'neon' : 'default'}>
            {isLidar ? 'LiDAR Scan' : 'Photo Scan'}
          </Badge>
          <Badge variant={confidenceVariant}>
            {Math.round(confidence_score * 100)}% confidence
          </Badge>
        </div>
      </div>

      {/* Body Composition Cards */}
      <div className="grid grid-cols-2 gap-3">
        <MetricCard
          label="Body Fat"
          value={`${composition.body_fat_pct}%`}
          icon={<Droplets className="h-4 w-4" />}
        />
        <MetricCard
          label="Lean Mass"
          value={`${composition.lean_mass_kg} kg`}
          icon={<TrendingUp className="h-4 w-4" />}
        />
        <MetricCard
          label="Fat Mass"
          value={`${composition.fat_mass_kg} kg`}
          icon={<Flame className="h-4 w-4" />}
        />
        <MetricCard
          label="BMI"
          value={`${composition.bmi}`}
          icon={<Scale className="h-4 w-4" />}
        />
      </div>

      {/* Body Fat Detail */}
      <Card>
        <CardHeader>
          <CardTitle>Body Fat Breakdown</CardTitle>
        </CardHeader>
        <div className="space-y-3">
          {composition.body_fat_smpl != null && (
            <div className="flex justify-between items-center">
              <span className="text-sm text-text-muted">SMPL Model</span>
              <span className="font-mono text-sm">{composition.body_fat_smpl}%</span>
            </div>
          )}
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Navy Formula</span>
            <span className="font-mono text-sm">{composition.body_fat_navy}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">CUN-BAE Formula</span>
            <span className="font-mono text-sm">{composition.body_fat_cunbae}%</span>
          </div>
          <div className="flex justify-between items-center border-t border-white/5 pt-3">
            <span className="text-sm text-text font-medium">Ensemble</span>
            <span className="font-mono text-sm text-neon font-bold">{composition.body_fat_pct}%</span>
          </div>
          <div className="flex justify-between items-center">
            <span className="text-sm text-text-muted">Waist-Hip Ratio</span>
            <span className="font-mono text-sm">{composition.waist_hip_ratio}</span>
          </div>
        </div>
      </Card>

      {/* 3D Body Model */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Box className="h-4 w-4" />
            3D Body Model
          </CardTitle>
        </CardHeader>
        {result.mesh_vertices && result.mesh_faces ? (
          <div className="h-[400px] -mx-4 -mb-4">
            <AvatarViewer
              vertices={result.mesh_vertices}
              faces={result.mesh_faces}
              colorByRegion
              showMeasurements
              measurements={circumferences.map((c) => ({
                region: c.region,
                circumference_cm: c.circumference_cm,
              }))}
            />
          </div>
        ) : (
          <div className="flex items-center justify-center py-8 text-text-dim text-sm">
            3D model not available for this scan
          </div>
        )}
      </Card>

      {/* Circumference Measurements */}
      <Card>
        <CardHeader>
          <CardTitle>Circumferences</CardTitle>
          <Badge variant="default">{circumferences.length} regions</Badge>
        </CardHeader>
        <div className="space-y-2">
          {circumferences.map((c) => {
            const regionKey = `${c.region}_cm`;
            const label = measurementLabels[regionKey] || c.region;
            const confColor =
              c.confidence >= 0.8 ? 'text-neon' : c.confidence >= 0.6 ? 'text-electric' : 'text-hot';

            return (
              <div key={c.region} className="flex items-center justify-between py-1.5">
                <span className="text-sm text-text-muted">{label}</span>
                <div className="flex items-center gap-3">
                  <span className="font-mono text-sm font-medium">{c.circumference_cm} cm</span>
                  <span className={`text-xs font-mono ${confColor}`}>
                    {Math.round(c.confidence * 100)}%
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </Card>

      {/* Calibration Info */}
      <Card className="opacity-60">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-4 w-4 text-text-dim" />
          <span className="text-xs text-text-dim font-medium">Calibration</span>
        </div>
        <div className="grid grid-cols-2 gap-2 text-xs text-text-dim font-mono">
          <span>Height: {calibration.height_cm} cm</span>
          <span>Weight: {calibration.weight_kg} kg</span>
          <span>Age: {calibration.age}</span>
          <span>Sex: {calibration.sex}</span>
        </div>
      </Card>
    </div>
  );
}
