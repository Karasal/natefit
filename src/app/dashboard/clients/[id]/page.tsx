'use client';


import { useEffect, useState } from 'react';
import { useParams } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { MetricCard } from '@/components/ui/MetricCard';
import { createClient } from '@/lib/supabase/client';
import { formatDate, formatRelativeTime } from '@/lib/utils/format';
import { Scan, ArrowRight, Activity, Droplets } from 'lucide-react';
import Link from 'next/link';
import type { Client, Scan as ScanType, Measurement } from '@/lib/types';

export default function ClientDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [client, setClient] = useState<Client | null>(null);
  const [scans, setScans] = useState<(ScanType & { measurements: Measurement | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const [clientRes, scansRes] = await Promise.all([
        supabase.from('clients').select('*').eq('id', id).single(),
        supabase
          .from('scans')
          .select('*, measurements(*)')
          .eq('client_id', id)
          .order('created_at', { ascending: false }),
      ]);

      setClient(clientRes.data);
      setScans(
        (scansRes.data || []).map((s: any) => ({
          ...s,
          measurements: s.measurements?.[0] || null,
        }))
      );
      setLoading(false);
    }
    load();
  }, [id]);

  if (loading) {
    return <div className="space-y-4">{[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-20 animate-pulse" />)}</div>;
  }

  if (!client) {
    return <p className="text-text-dim">Client not found.</p>;
  }

  const latestScan = scans[0];
  const latestMeasurement = latestScan?.measurements;

  return (
    <>
      <PageHeader
        title={client.full_name}
        description={client.email}
        actions={
          <Link href={`/dashboard/scan/${client.id}`}>
            <Button icon={<Scan className="h-4 w-4" />}>New Scan</Button>
          </Link>
        }
      />

      {/* Latest metrics */}
      {latestMeasurement ? (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <MetricCard
            label="Body Fat"
            value={`${latestMeasurement.body_fat_pct ?? '—'}%`}
            icon={<Droplets className="h-4 w-4" />}
          />
          <MetricCard
            label="Lean Mass"
            value={`${latestMeasurement.lean_mass_kg ?? '—'} kg`}
            icon={<Activity className="h-4 w-4" />}
          />
          <MetricCard
            label="Waist"
            value={`${latestMeasurement.waist_cm ?? '—'} cm`}
          />
          <MetricCard
            label="BMI"
            value={`${latestMeasurement.bmi ?? '—'}`}
          />
        </div>
      ) : (
        <Card className="text-center py-8 mb-8">
          <Scan className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <p className="text-sm text-text-dim mb-4">No scans yet for this client.</p>
          <Link href={`/dashboard/scan/${client.id}`}>
            <Button variant="secondary" size="sm">Start First Scan</Button>
          </Link>
        </Card>
      )}

      {/* Scan History */}
      <Card>
        <CardHeader>
          <CardTitle>Scan History</CardTitle>
          <Badge variant="default">{scans.length} scans</Badge>
        </CardHeader>
        {scans.length === 0 ? (
          <p className="text-sm text-text-dim py-4">No scans recorded yet.</p>
        ) : (
          <div className="divide-y divide-white/5">
            {scans.map((scan) => (
              <Link
                key={scan.id}
                href={`/dashboard/clients/${client.id}/scans/${scan.id}`}
                className="flex items-center justify-between py-3 hover:bg-white/5 -mx-5 px-5 transition-colors"
              >
                <div>
                  <p className="text-sm font-medium">{formatDate(scan.created_at)}</p>
                  <p className="text-xs text-text-dim">
                    {scan.status === 'completed' ? (
                      <>BF: {scan.measurements?.body_fat_pct ?? '—'}%</>
                    ) : (
                      scan.status
                    )}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant={scan.status === 'completed' ? 'neon' : 'default'}>
                    {scan.status}
                  </Badge>
                  <ArrowRight className="h-4 w-4 text-text-dim" />
                </div>
              </Link>
            ))}
          </div>
        )}
      </Card>
    </>
  );
}
