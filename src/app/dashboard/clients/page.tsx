'use client';


import { useEffect, useState } from 'react';
import { PageHeader } from '@/components/layout/PageHeader';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Badge } from '@/components/ui/Badge';
import { Card } from '@/components/ui/Card';
import { createClient } from '@/lib/supabase/client';
import { Plus, Search, Users, ArrowRight } from 'lucide-react';
import Link from 'next/link';
import { formatRelativeTime } from '@/lib/utils/format';
import type { Client } from '@/lib/types';

export default function ClientsPage() {
  const [clients, setClients] = useState<Client[]>([]);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from('clients')
        .select('*')
        .order('updated_at', { ascending: false });
      setClients(data || []);
      setLoading(false);
    }
    load();
  }, []);

  const filtered = search
    ? clients.filter(
        (c) =>
          c.full_name.toLowerCase().includes(search.toLowerCase()) ||
          c.email.toLowerCase().includes(search.toLowerCase())
      )
    : clients;

  return (
    <>
      <PageHeader
        title="Clients"
        description={`${clients.length} client${clients.length !== 1 ? 's' : ''}`}
        actions={
          <Link href="/dashboard/clients/new">
            <Button icon={<Plus className="h-4 w-4" />}>Add Client</Button>
          </Link>
        }
      />

      {/* Search */}
      <div className="mb-6">
        <Input
          placeholder="Search clients..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-sm"
        />
      </div>

      {/* Client list */}
      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="glass rounded-xl h-20 animate-pulse" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <Card className="text-center py-12">
          <Users className="h-10 w-10 text-text-dim mx-auto mb-3" />
          <p className="text-text-muted mb-4">
            {search ? 'No clients match your search.' : 'No clients yet.'}
          </p>
          {!search && (
            <Link href="/dashboard/clients/new">
              <Button variant="secondary">Add Your First Client</Button>
            </Link>
          )}
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((client) => (
            <Link
              key={client.id}
              href={`/dashboard/clients/${client.id}`}
              className="glass glass-hover rounded-xl p-4 flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-neon/10 flex items-center justify-center text-neon font-display font-bold text-sm">
                  {client.full_name.charAt(0).toUpperCase()}
                </div>
                <div>
                  <p className="text-sm font-medium text-text">{client.full_name}</p>
                  <p className="text-xs text-text-dim">{client.email}</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                {client.tags?.map((tag) => (
                  <Badge key={tag} variant="default">{tag}</Badge>
                ))}
                <span className="text-xs text-text-dim hidden sm:block">
                  {formatRelativeTime(client.updated_at)}
                </span>
                <ArrowRight className="h-4 w-4 text-text-dim" />
              </div>
            </Link>
          ))}
        </div>
      )}
    </>
  );
}
