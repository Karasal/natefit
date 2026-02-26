'use client';


import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Scan, Dumbbell, User } from 'lucide-react';
import Link from 'next/link';
import type { UserRole } from '@/lib/types';

export default function SignupPage() {
  const [step, setStep] = useState<'role' | 'details'>('role');
  const [role, setRole] = useState<UserRole>('trainer');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const router = useRouter();
  const supabase = createClient();

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim() || !email || !password) {
      setError('All fields are required');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);
    setError('');

    const { data, error: authError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName.trim(), role },
        emailRedirectTo: `${window.location.origin}/api/auth/callback`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (data.user) {
      // Create profile
      await supabase.from('profiles').insert({
        id: data.user.id,
        email,
        full_name: fullName.trim(),
        role,
      });

      // If trainer, create org
      if (role === 'trainer') {
        const { data: org } = await supabase
          .from('organizations')
          .insert({
            name: `${fullName.trim()}'s Practice`,
            slug: fullName.trim().toLowerCase().replace(/\s+/g, '-') + '-' + Date.now(),
            owner_id: data.user.id,
            plan_tier: 'free',
            max_clients: 5,
          })
          .select()
          .single();

        if (org) {
          await supabase.from('org_members').insert({
            org_id: org.id,
            user_id: data.user.id,
            role: 'owner',
          });
        }
      }
    }

    router.push(role === 'trainer' ? '/dashboard' : '/portal');
  };

  if (step === 'role') {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-sm w-full">
          <div className="text-center mb-8">
            <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center mx-auto mb-3">
              <Scan className="h-7 w-7 text-neon" />
            </div>
            <h1 className="font-display text-2xl font-bold mb-1">Join NATEFIT</h1>
            <p className="text-sm text-text-muted">How will you use NATEFIT?</p>
          </div>

          <div className="space-y-3 mb-6">
            <button
              onClick={() => { setRole('trainer'); setStep('details'); }}
              className="glass glass-hover rounded-xl p-4 w-full text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-neon/10 flex items-center justify-center">
                <Dumbbell className="h-6 w-6 text-neon" />
              </div>
              <div>
                <p className="font-medium">I&apos;m a Trainer</p>
                <p className="text-xs text-text-dim">Scan clients, track progress</p>
              </div>
            </button>

            <button
              onClick={() => { setRole('client'); setStep('details'); }}
              className="glass glass-hover rounded-xl p-4 w-full text-left flex items-center gap-4"
            >
              <div className="w-12 h-12 rounded-lg bg-electric/10 flex items-center justify-center">
                <User className="h-6 w-6 text-electric" />
              </div>
              <div>
                <p className="font-medium">I&apos;m Tracking Myself</p>
                <p className="text-xs text-text-dim">Self-scan, track my progress</p>
              </div>
            </button>
          </div>

          <p className="text-xs text-text-dim text-center">
            Already have an account?{' '}
            <Link href="/login" className="text-neon hover:underline">Sign in</Link>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <h1 className="font-display text-2xl font-bold">Create Account</h1>
          <p className="text-sm text-text-muted mt-1">
            {role === 'trainer' ? 'Trainer account' : 'Personal account'}
          </p>
        </div>

        <form onSubmit={handleSignup} className="space-y-4">
          <Input
            label="Full Name"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
          />
          <Input
            label="Email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com"
          />
          <Input
            label="Password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="6+ characters"
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="w-full">
            Create Account
          </Button>
        </form>

        <button
          onClick={() => setStep('role')}
          className="text-xs text-text-dim hover:text-text mt-4 block mx-auto"
        >
          Back to role selection
        </button>
      </div>
    </div>
  );
}
