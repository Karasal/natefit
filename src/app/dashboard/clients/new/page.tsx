'use client';


import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { PageHeader } from '@/components/layout/PageHeader';
import { Card } from '@/components/ui/Card';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { createClient } from '@/lib/supabase/client';
import { useAuth } from '@/components/providers/AuthProvider';
import { useToast } from '@/components/providers/ToastProvider';
import { UserPlus } from 'lucide-react';

export default function NewClientPage() {
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [notes, setNotes] = useState('');
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const router = useRouter();
  const supabase = createClient();
  const { profile } = useAuth();
  const { toast } = useToast();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const newErrors: Record<string, string> = {};
    if (!fullName.trim()) newErrors.fullName = 'Name is required';
    if (!email.trim()) newErrors.email = 'Email is required';
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }

    setLoading(true);

    // Get user's org
    const { data: orgMember } = await supabase
      .from('org_members')
      .select('org_id')
      .eq('user_id', profile?.id)
      .single();

    if (!orgMember) {
      toast('Organization not found', 'error');
      setLoading(false);
      return;
    }

    const inviteToken = crypto.randomUUID();

    const { error } = await supabase.from('clients').insert({
      org_id: orgMember.org_id,
      email: email.trim(),
      full_name: fullName.trim(),
      notes: notes.trim() || null,
      invite_token: inviteToken,
      invite_status: 'pending',
      tags: [],
    });

    if (error) {
      toast(error.message, 'error');
      setLoading(false);
      return;
    }

    toast(`${fullName} added successfully`, 'success');
    router.push('/dashboard/clients');
  };

  return (
    <>
      <PageHeader title="Add Client" description="Add a new client to your roster." />

      <Card className="max-w-lg">
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="John Doe"
            error={errors.fullName}
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="john@example.com"
            error={errors.email}
          />
          <div className="flex flex-col gap-1.5">
            <label className="text-sm font-medium text-text-muted">Notes (optional)</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Training goals, injuries, etc."
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-white/5 border border-white/10 text-text placeholder:text-text-dim text-sm focus:outline-none focus:border-neon/50 focus:ring-1 focus:ring-neon/20 resize-none"
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="ghost" type="button" onClick={() => router.back()}>
              Cancel
            </Button>
            <Button type="submit" loading={loading} icon={<UserPlus className="h-4 w-4" />}>
              Add Client
            </Button>
          </div>
        </form>
      </Card>
    </>
  );
}
