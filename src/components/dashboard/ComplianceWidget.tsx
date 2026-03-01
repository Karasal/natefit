'use client';

import { useEffect, useState, useCallback } from 'react';
import { useOrganization } from '@/components/providers/OrganizationProvider';
import { createClient } from '@/lib/supabase/client';
import { complianceService } from '@/lib/services';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { PieChart, Pie, Cell, ResponsiveContainer } from 'recharts';
import { AlertTriangle, TrendingDown, Activity } from 'lucide-react';
import Link from 'next/link';
import type { AtRiskClient } from '@/lib/services/complianceService';

// ============================================================
// Color helpers
// ============================================================

function rateColor(rate: number | null): string {
  if (rate === null) return '#64748B'; // text-dim
  if (rate >= 75) return '#00FF87'; // neon
  if (rate >= 50) return '#3B82F6'; // electric
  return '#EF4444'; // danger
}

function rateLabel(rate: number | null): string {
  if (rate === null) return 'N/A';
  if (rate >= 75) return 'Good';
  if (rate >= 50) return 'Fair';
  return 'Low';
}

// ============================================================
// Ring Chart Component
// ============================================================

function ComplianceRing({
  label,
  rate,
  size = 100,
}: {
  label: string;
  rate: number | null;
  size?: number;
}) {
  const value = rate ?? 0;
  const color = rateColor(rate);
  const data = [
    { value: value },
    { value: 100 - value },
  ];

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div style={{ width: size, height: size }} className="relative">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={data}
              cx="50%"
              cy="50%"
              innerRadius={size * 0.32}
              outerRadius={size * 0.45}
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
        <div className="absolute inset-0 flex items-center justify-center">
          <span
            className="font-mono text-sm font-bold"
            style={{ color }}
          >
            {rate !== null ? `${rate}%` : '--'}
          </span>
        </div>
      </div>
      <span className="text-xs text-text-muted">{label}</span>
      <span
        className="text-[10px] font-semibold uppercase tracking-wider"
        style={{ color }}
      >
        {rateLabel(rate)}
      </span>
    </div>
  );
}

// ============================================================
// ComplianceWidget
// ============================================================

export default function ComplianceWidget() {
  const { org } = useOrganization();
  const supabase = createClient();

  const [averages, setAverages] = useState<{
    workout: number;
    nutrition: number;
    habits: number;
    overall: number;
  } | null>(null);
  const [atRisk, setAtRisk] = useState<AtRiskClient[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    if (!org) return;

    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    const dateRange = {
      from: weekAgo.toISOString().split('T')[0],
      to: now.toISOString().split('T')[0],
    };

    const [orgResult, riskResult] = await Promise.all([
      complianceService.getOrgCompliance(supabase, org.id, dateRange),
      complianceService.getAtRiskClients(supabase, org.id, 7),
    ]);

    if (orgResult.data) {
      setAverages(orgResult.data.averages);
    }
    if (riskResult.data) {
      setAtRisk(riskResult.data.slice(0, 5)); // Top 5 at risk
    }

    setLoading(false);
  }, [org, supabase]);

  useEffect(() => {
    load();
  }, [load]);

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Compliance</CardTitle>
        </CardHeader>
        <div className="flex items-center justify-center h-48">
          <div className="h-8 w-8 border-2 border-neon border-t-transparent rounded-full animate-spin" />
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-neon" />
            Compliance (7-day)
          </div>
        </CardTitle>
        {averages && (
          <span
            className="font-mono text-2xl font-bold"
            style={{ color: rateColor(averages.overall) }}
          >
            {averages.overall}%
          </span>
        )}
      </CardHeader>

      {/* Ring Charts */}
      {averages && (
        <div className="flex items-center justify-around mb-6">
          <ComplianceRing label="Workout" rate={averages.workout} />
          <ComplianceRing label="Nutrition" rate={averages.nutrition} />
          <ComplianceRing label="Habits" rate={averages.habits} />
        </div>
      )}

      {/* At Risk Section */}
      {atRisk.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-3 pt-3 border-t border-white/5">
            <AlertTriangle className="h-3.5 w-3.5 text-danger" />
            <span className="text-xs font-semibold text-danger uppercase tracking-wider">
              At Risk ({atRisk.length})
            </span>
          </div>
          <div className="space-y-2">
            {atRisk.map((client) => (
              <Link
                key={client.client_id}
                href={`/dashboard/clients/${client.client_id}`}
                className="flex items-center justify-between p-2.5 rounded-lg bg-white/[0.02] hover:bg-white/[0.05] transition-colors group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <TrendingDown className="h-3.5 w-3.5 text-danger shrink-0" />
                  <span className="text-sm text-text truncate group-hover:text-neon transition-colors">
                    {client.full_name}
                  </span>
                </div>
                <span
                  className="font-mono text-xs font-medium shrink-0 ml-2"
                  style={{ color: rateColor(client.complianceRate) }}
                >
                  {client.complianceRate}%
                </span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {atRisk.length === 0 && averages && (
        <div className="text-center py-3 border-t border-white/5 mt-2">
          <p className="text-xs text-text-dim">No at-risk clients this week</p>
        </div>
      )}

      {!averages && (
        <div className="text-center py-8">
          <Activity className="h-6 w-6 text-text-dim mx-auto mb-2" />
          <p className="text-sm text-text-dim">No compliance data yet</p>
        </div>
      )}
    </Card>
  );
}
