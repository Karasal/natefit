'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { complianceService } from '@/lib/services';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { Activity, Dumbbell, Apple, Sparkles, Calendar } from 'lucide-react';
import type { Client } from '@/lib/types';
import type {
  ClientCompliance,
  WeeklyTrendPoint,
} from '@/lib/services/complianceService';

// ============================================================
// Constants
// ============================================================

type RangeKey = '7d' | '30d' | '90d';

const RANGE_OPTIONS: { key: RangeKey; label: string; days: number }[] = [
  { key: '7d', label: 'Week', days: 7 },
  { key: '30d', label: 'Month', days: 30 },
  { key: '90d', label: 'Quarter', days: 90 },
];

const COLORS = {
  neon: '#00FF87',
  electric: '#3B82F6',
  hot: '#FF6B35',
  danger: '#EF4444',
  dim: '#64748B',
  grid: 'rgba(255,255,255,0.05)',
  tooltip: '#1E1E2E',
};

// ============================================================
// Helpers
// ============================================================

function formatDate(d: Date): string {
  return d.toISOString().split('T')[0];
}

function rateColor(rate: number | null): string {
  if (rate === null) return COLORS.dim;
  if (rate >= 75) return COLORS.neon;
  if (rate >= 50) return COLORS.electric;
  return COLORS.danger;
}

function formatWeekLabel(weekStart: string): string {
  const d = new Date(weekStart);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

// ============================================================
// Stat Card
// ============================================================

function StatCard({
  icon,
  label,
  value,
  subtext,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  subtext?: string;
  color: string;
}) {
  return (
    <Card className="flex flex-col items-center text-center py-6">
      <div className="mb-2" style={{ color }}>
        {icon}
      </div>
      <span className="text-xs text-text-muted mb-1">{label}</span>
      <span className="font-mono text-2xl font-bold" style={{ color }}>
        {value}
      </span>
      {subtext && (
        <span className="text-[11px] text-text-dim mt-1">{subtext}</span>
      )}
    </Card>
  );
}

// ============================================================
// Donut summary
// ============================================================

function OverallDonut({ rate }: { rate: number }) {
  const color = rateColor(rate);
  const data = [
    { value: rate },
    { value: 100 - rate },
  ];

  return (
    <Card className="flex flex-col items-center py-6">
      <span className="text-xs text-text-muted mb-3">Overall Compliance</span>
      <div className="relative" style={{ width: 140, height: 140 }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={45}
              outerRadius={62}
              startAngle={90}
              endAngle={-270}
              dataKey="value"
              stroke="none"
            >
              <Cell fill={color} />
              <Cell fill="rgba(255,255,255,0.05)" />
            </Pie>
          </PieChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-3xl font-bold" style={{ color }}>
            {rate}%
          </span>
        </div>
      </div>
    </Card>
  );
}

// ============================================================
// Custom Tooltip
// ============================================================

function ChartTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return (
    <div
      className="rounded-lg px-3 py-2 text-xs shadow-lg border border-white/10"
      style={{ background: COLORS.tooltip }}
    >
      <p className="text-text-muted mb-1 font-medium">{label}</p>
      {payload.map((entry: any) => (
        <p key={entry.dataKey} style={{ color: entry.color }}>
          {entry.name}: {entry.value}%
        </p>
      ))}
    </div>
  );
}

// ============================================================
// Page Component
// ============================================================

export default function ClientCompliancePage() {
  const { id } = useParams<{ id: string }>();
  const supabase = createClient();

  const [client, setClient] = useState<Client | null>(null);
  const [compliance, setCompliance] = useState<ClientCompliance | null>(null);
  const [trend, setTrend] = useState<WeeklyTrendPoint[]>([]);
  const [range, setRange] = useState<RangeKey>('30d');
  const [loading, setLoading] = useState(true);
  const [trendLoading, setTrendLoading] = useState(true);

  // Load client data + compliance for selected range
  const loadCompliance = useCallback(async () => {
    setLoading(true);
    const days = RANGE_OPTIONS.find((r) => r.key === range)!.days;
    const now = new Date();
    const start = new Date(now.getTime() - days * 86400000);
    const dateRange = { from: formatDate(start), to: formatDate(now) };

    const [clientRes, complianceRes] = await Promise.all([
      supabase.from('clients').select('*').eq('id', id).single(),
      complianceService.getClientCompliance(supabase, id, dateRange),
    ]);

    setClient(clientRes.data);
    setCompliance(complianceRes.data);
    setLoading(false);
  }, [id, range, supabase]);

  // Load trend data (always 8 weeks)
  const loadTrend = useCallback(async () => {
    setTrendLoading(true);
    const { data } = await complianceService.getWeeklyComplianceTrend(supabase, id, 8);
    setTrend(data || []);
    setTrendLoading(false);
  }, [id, supabase]);

  useEffect(() => {
    loadCompliance();
  }, [loadCompliance]);

  useEffect(() => {
    loadTrend();
  }, [loadTrend]);

  // Chart data
  const chartData = trend.map((t) => ({
    week: formatWeekLabel(t.weekStart),
    Workout: t.workout,
    Nutrition: t.nutrition,
    Habits: t.habits,
  }));

  // Loading skeleton
  if (loading && !compliance) {
    return (
      <div className="space-y-4">
        <div className="glass rounded-xl h-16 animate-pulse" />
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="glass rounded-xl h-32 animate-pulse" />
          ))}
        </div>
        <div className="glass rounded-xl h-72 animate-pulse" />
      </div>
    );
  }

  return (
    <>
      <PageHeader
        title={`${client?.full_name || 'Client'} -- Compliance`}
        description="Workout, nutrition, and habit adherence tracking"
        actions={
          <div className="flex items-center gap-1 glass rounded-lg p-1">
            {RANGE_OPTIONS.map((opt) => (
              <Button
                key={opt.key}
                variant={range === opt.key ? 'primary' : 'ghost'}
                size="sm"
                onClick={() => setRange(opt.key)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
        }
      />

      {compliance && (
        <>
          {/* Summary Row */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <OverallDonut rate={compliance.overall} />
            <StatCard
              icon={<Dumbbell className="h-5 w-5" />}
              label="Workouts"
              value={
                compliance.workout.rate !== null
                  ? `${compliance.workout.rate}%`
                  : '--'
              }
              subtext={`${compliance.workout.completed} / ${compliance.workout.scheduled} completed`}
              color={rateColor(compliance.workout.rate)}
            />
            <StatCard
              icon={<Apple className="h-5 w-5" />}
              label="Nutrition"
              value={`${compliance.nutrition.rate}%`}
              subtext={`${compliance.nutrition.daysLogged} days logged, ${compliance.nutrition.daysHittingTargets} on target`}
              color={rateColor(compliance.nutrition.rate)}
            />
            <StatCard
              icon={<Sparkles className="h-5 w-5" />}
              label="Habits"
              value={`${compliance.habits.rate}%`}
              subtext={`${compliance.habits.completed} / ${compliance.habits.total} completed`}
              color={rateColor(compliance.habits.rate)}
            />
          </div>

          {/* Weekly Trend Chart */}
          <Card className="mb-6">
            <CardHeader>
              <CardTitle>
                <div className="flex items-center gap-2">
                  <Calendar className="h-4 w-4 text-electric" />
                  8-Week Trend
                </div>
              </CardTitle>
            </CardHeader>
            {trendLoading ? (
              <div className="flex items-center justify-center h-64">
                <div className="h-6 w-6 border-2 border-neon border-t-transparent rounded-full animate-spin" />
              </div>
            ) : chartData.length > 0 ? (
              <div className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={chartData} barGap={2}>
                    <CartesianGrid
                      strokeDasharray="3 3"
                      stroke={COLORS.grid}
                      vertical={false}
                    />
                    <XAxis
                      dataKey="week"
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 100]}
                      tick={{ fill: '#94A3B8', fontSize: 11 }}
                      axisLine={false}
                      tickLine={false}
                      tickFormatter={(v) => `${v}%`}
                    />
                    <Tooltip content={<ChartTooltip />} />
                    <Legend
                      wrapperStyle={{ fontSize: 11, color: '#94A3B8' }}
                    />
                    <Bar
                      dataKey="Workout"
                      fill={COLORS.neon}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="Nutrition"
                      fill={COLORS.electric}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="Habits"
                      fill={COLORS.hot}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="text-center py-12">
                <Activity className="h-6 w-6 text-text-dim mx-auto mb-2" />
                <p className="text-sm text-text-dim">
                  No trend data available yet
                </p>
              </div>
            )}
          </Card>

          {/* Breakdown Details */}
          <div className="grid gap-4 lg:grid-cols-3">
            {/* Workout Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Dumbbell className="h-4 w-4 text-neon" />
                    Workouts
                  </div>
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Completed</span>
                  <span className="font-mono text-text">
                    {compliance.workout.completed}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Scheduled</span>
                  <span className="font-mono text-text">
                    {compliance.workout.scheduled}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Completion Rate</span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: rateColor(compliance.workout.rate),
                    }}
                  >
                    {compliance.workout.rate !== null
                      ? `${compliance.workout.rate}%`
                      : 'N/A'}
                  </span>
                </div>
                {/* Progress bar */}
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${compliance.workout.rate ?? 0}%`,
                      background: rateColor(compliance.workout.rate),
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* Nutrition Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Apple className="h-4 w-4 text-electric" />
                    Nutrition
                  </div>
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Days Logged</span>
                  <span className="font-mono text-text">
                    {compliance.nutrition.daysLogged} / {compliance.nutrition.totalDays}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">On Target</span>
                  <span className="font-mono text-text">
                    {compliance.nutrition.daysHittingTargets} days
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Logging Rate</span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: rateColor(compliance.nutrition.rate),
                    }}
                  >
                    {compliance.nutrition.rate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${compliance.nutrition.rate}%`,
                      background: rateColor(compliance.nutrition.rate),
                    }}
                  />
                </div>
              </div>
            </Card>

            {/* Habits Breakdown */}
            <Card>
              <CardHeader>
                <CardTitle>
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-hot" />
                    Habits
                  </div>
                </CardTitle>
              </CardHeader>
              <div className="space-y-3">
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Completed</span>
                  <span className="font-mono text-text">
                    {compliance.habits.completed}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Total Possible</span>
                  <span className="font-mono text-text">
                    {compliance.habits.total}
                  </span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-text-muted">Completion Rate</span>
                  <span
                    className="font-mono font-semibold"
                    style={{
                      color: rateColor(compliance.habits.rate),
                    }}
                  >
                    {compliance.habits.rate}%
                  </span>
                </div>
                <div className="h-2 rounded-full bg-white/5 overflow-hidden mt-1">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${compliance.habits.rate}%`,
                      background: rateColor(compliance.habits.rate),
                    }}
                  />
                </div>
              </div>
            </Card>
          </div>
        </>
      )}

      {!compliance && !loading && (
        <Card className="text-center py-12">
          <Activity className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <p className="text-sm text-text-dim">
            No compliance data available for this period.
          </p>
        </Card>
      )}
    </>
  );
}
