'use client';


import { useEffect, useState } from 'react';
import { Card } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { useAuth } from '@/components/providers/AuthProvider';
import { createClient } from '@/lib/supabase/client';
import { formatDate } from '@/lib/utils/format';
import { History, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import type { Scan, Measurement } from '@/lib/types';

export default function HistoryPage() {
  const { profile } = useAuth();
  const [scans, setScans] = useState<(Scan & { measurements: Measurement | null })[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      if (!profile) return;

      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('user_id', profile.id)
        .single();

      if (!client) { setLoading(false); return; }

      const { data } = await supabase
        .from('scans')
        .select('*, measurements(*)')
        .eq('client_id', client.id)
        .eq('status', 'completed')
        .order('created_at', { ascending: false });

      setScans(
        (data || []).map((s: any) => ({
          ...s,
          measurements: s.measurements?.[0] || null,
        }))
      );
      setLoading(false);
    }
    load();
  }, [profile]);

  return (
    <>
      <h1 className="font-display text-2xl font-bold mb-6">Scan History</h1>

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <div key={i} className="glass rounded-xl h-16 animate-pulse" />)}
        </div>
      ) : scans.length === 0 ? (
        <Card className="text-center py-12">
          <History className="h-8 w-8 text-text-dim mx-auto mb-3" />
          <p className="text-sm text-text-dim">No completed scans yet.</p>
        </Card>
      ) : (
        <div className="space-y-2">
          {scans.map((scan) => (
            <Link
              key={scan.id}
              href={`/portal/history/${scan.id}`}
              className="glass glass-hover rounded-xl p-4 flex items-center justify-between"
            >
              <div>
                <p className="text-sm font-medium">{formatDate(scan.created_at)}</p>
                <p className="text-xs text-text-dim">
                  BF: {scan.measurements?.body_fat_pct ?? '—'}%
                  {' / '}
                  Waist: {scan.measurements?.waist_cm ?? '—'} cm
                </p>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="neon">
                  {Math.round((scan.measurements?.confidence_score ?? 0) * 100)}%
                </Badge>
                <ArrowRight className="h-4 w-4 text-text-dim" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
