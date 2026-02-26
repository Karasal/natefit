'use client';

import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import type { Measurement } from '@/lib/types';
import { measurementLabels, measurementUnits } from '@/lib/data/site';
import { formatMeasurement, formatDelta } from '@/lib/utils/format';

interface MeasurementTableProps {
  current: Measurement;
  previous?: Measurement | null;
}

const circumferenceKeys = [
  'neck_cm', 'shoulders_cm', 'chest_cm',
  'left_bicep_cm', 'right_bicep_cm',
  'left_forearm_cm', 'right_forearm_cm', 'wrist_cm',
  'waist_cm', 'hips_cm',
  'left_thigh_cm', 'right_thigh_cm',
  'left_calf_cm', 'right_calf_cm',
] as const;

export function MeasurementTable({ current, previous }: MeasurementTableProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Measurements</CardTitle>
        {previous && <Badge variant="electric">vs previous</Badge>}
      </CardHeader>
      <div className="divide-y divide-white/5">
        {circumferenceKeys.map((key) => {
          const value = current[key as keyof Measurement] as number | null;
          const prevValue = previous?.[key as keyof Measurement] as number | null;
          const label = measurementLabels[key] || key;
          const unit = measurementUnits[key] || '';

          if (value === null) return null;

          const delta = prevValue !== null && prevValue !== undefined
            ? value - prevValue
            : null;
          const deltaColor = delta
            ? delta > 0 ? 'text-hot' : delta < 0 ? 'text-neon' : 'text-text-dim'
            : '';

          return (
            <div key={key} className="flex items-center justify-between py-2.5 px-1">
              <span className="text-sm text-text-muted">{label}</span>
              <div className="flex items-center gap-3">
                <span className="font-mono text-sm">
                  {formatMeasurement(value, unit)}
                </span>
                {delta !== null && delta !== 0 && (
                  <span className={`font-mono text-xs ${deltaColor}`}>
                    {formatDelta(value, prevValue!)} {unit}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}
