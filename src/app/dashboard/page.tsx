'use client';


import { PageHeader } from '@/components/layout/PageHeader';
import { MetricCard } from '@/components/ui/MetricCard';
import { Card, CardHeader, CardTitle } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { useAuth } from '@/components/providers/AuthProvider';
import { Users, Scan, TrendingUp, Activity, Plus, ArrowRight } from 'lucide-react';
import Link from 'next/link';

export default function DashboardPage() {
  const { profile } = useAuth();

  return (
    <>
      <PageHeader
        title={`Welcome back${profile?.full_name ? `, ${profile.full_name.split(' ')[0]}` : ''}`}
        description="Here's what's happening with your clients."
        actions={
          <Link href="/dashboard/clients/new">
            <Button icon={<Plus className="h-4 w-4" />}>Add Client</Button>
          </Link>
        }
      />

      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <MetricCard
          label="Total Clients"
          value="0"
          icon={<Users className="h-4 w-4" />}
        />
        <MetricCard
          label="Scans This Week"
          value="0"
          icon={<Scan className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. Body Fat"
          value="—"
          icon={<Activity className="h-4 w-4" />}
        />
        <MetricCard
          label="Avg. Progress"
          value="—"
          icon={<TrendingUp className="h-4 w-4" />}
        />
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        {/* Recent Scans */}
        <Card>
          <CardHeader>
            <CardTitle>Recent Scans</CardTitle>
          </CardHeader>
          <div className="flex flex-col items-center py-8 text-center">
            <Scan className="h-8 w-8 text-text-dim mb-3" />
            <p className="text-sm text-text-dim mb-4">No scans yet. Start by adding a client.</p>
            <Link href="/dashboard/clients/new">
              <Button variant="secondary" size="sm">
                Add Your First Client
              </Button>
            </Link>
          </div>
        </Card>

        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle>Quick Actions</CardTitle>
          </CardHeader>
          <div className="space-y-2">
            <Link href="/dashboard/clients/new" className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-neon/10 flex items-center justify-center">
                  <Plus className="h-4 w-4 text-neon" />
                </div>
                <span className="text-sm font-medium">Add New Client</span>
              </div>
              <ArrowRight className="h-4 w-4 text-text-dim" />
            </Link>
            <Link href="/dashboard/clients" className="flex items-center justify-between p-3 rounded-lg hover:bg-white/5 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-electric/10 flex items-center justify-center">
                  <Users className="h-4 w-4 text-electric" />
                </div>
                <span className="text-sm font-medium">View All Clients</span>
              </div>
              <ArrowRight className="h-4 w-4 text-text-dim" />
            </Link>
          </div>
        </Card>
      </div>
    </>
  );
}
