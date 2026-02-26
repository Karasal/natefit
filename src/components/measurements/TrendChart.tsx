'use client';

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from 'recharts';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import type { ChartDataPoint } from '@/lib/types';

interface TrendChartProps {
  title: string;
  data: ChartDataPoint[];
  unit?: string;
  color?: string;
  height?: number;
}

export function TrendChart({
  title,
  data,
  unit = '',
  color = '#00FF87',
  height = 200,
}: TrendChartProps) {
  if (data.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
        </CardHeader>
        <div className="h-[200px] flex items-center justify-center text-text-dim text-sm">
          No data yet
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {data.length > 0 && (
          <span className="font-mono text-sm text-text-muted">
            {data[data.length - 1].value}{unit}
          </span>
        )}
      </CardHeader>
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 5, right: 5, bottom: 5, left: -15 }}>
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(255,255,255,0.05)"
            vertical={false}
          />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 10, fill: '#64748B' }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#64748B' }}
            tickLine={false}
            axisLine={false}
            domain={['auto', 'auto']}
          />
          <Tooltip
            contentStyle={{
              background: '#1E1E2E',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: '8px',
              fontSize: '12px',
            }}
            labelStyle={{ color: '#94A3B8' }}
            itemStyle={{ color }}
            formatter={(value) => [`${value ?? ''}${unit}`, title]}
          />
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={{ fill: color, r: 3 }}
            activeDot={{ r: 5, fill: color }}
          />
        </LineChart>
      </ResponsiveContainer>
    </Card>
  );
}
