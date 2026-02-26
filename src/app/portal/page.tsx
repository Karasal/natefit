'use client';


import { useEffect, useState } from 'react';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { BodyFatGauge } from '@/components/measurements/BodyFatGauge';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { Scan, Activity, TrendingUp } from 'lucide-react';
import Link from 'next/link';
import { formatDate } from '@/lib/utils/format';
import type { Measurement } from '@/lib/types';

export default function PortalHomePage() {
  const { profile } = useAuth();
  const [latest, setLatest] = useState<Measurement | null>(null);
  const [scanCount, setScanCount] = useState(0);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!profile) return;

      // Get client record for this user
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (!client) return;

      const [latestRes, countRes] = await Promise.all([
        supabase
          .from('measurements')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: false })
          .limit(1)
          .single(),
        supabase
          .from('scans')
          .select('id', { count: 'exact', head: true })
          .eq('client_id', client.id)
          .eq('status', 'completed'),
      ]);

      setLatest(latestRes.data);
      setScanCount(countRes.count || 0);
    }
    load();
  }, [profile]);

  return (
    <>
      <div className="mb-8">
        <h1 className="font-display text-2xl font-bold">
          Welcome{profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}
        </h1>
        <p className="text-sm text-text-muted mt-1">Your body composition journey</p>
      </div>

      {latest ? (
        <>
          <div className="grid grid-cols-2 gap-3 mb-6">
            <MetricCard
              label="Body Fat"
              value={`${latest.body_fat_pct ?? '—'}%`}
              icon={<Activity className="h-4 w-4" />}
            />
            <MetricCard
              label="Lean Mass"
              value={`${latest.lean_mass_kg ?? '—'} kg`}
              icon={<TrendingUp className="h-4 w-4" />}
            />
          </div>

          {latest.body_fat_pct && profile?.sex && (
            <div className="mb-6">
              <BodyFatGauge
                percentage={latest.body_fat_pct}
                sex={profile.sex as 'male' | 'female'}
              />
            </div>
          )}

          <div className="flex gap-3">
            <Link href="/portal/scan" className="flex-1">
              <Button className="w-full" icon={<Scan className="h-4 w-4" />}>
                New Scan
              </Button>
            </Link>
            <Link href="/portal/history" className="flex-1">
              <Button variant="secondary" className="w-full">
                View History ({scanCount})
              </Button>
            </Link>
          </div>
        </>
      ) : (
        <Card className="text-center py-12">
          <Scan className="h-12 w-12 text-text-dim mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">Ready for your first scan?</h2>
          <p className="text-sm text-text-muted mb-6 max-w-sm mx-auto">
            Take two photos and get your body measurements in seconds.
          </p>
          <Link href="/portal/scan">
            <Button icon={<Scan className="h-4 w-4" />}>Start Scan</Button>
          </Link>
        </Card>
      )}
    </>
  );
}
