'use client';

import { Suspense, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Scan, Mail } from 'lucide-react';
import Link from 'next/link';

function LoginForm() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);

  const router = useRouter();
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/dashboard';
  const supabase = createClient();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push(redirect);
  };

  const handleMagicLink = async () => {
    if (!email) {
      setError('Enter your email first');
      return;
    }
    setLoading(true);
    setError('');

    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/api/auth/callback?redirect=${redirect}` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setMagicLinkSent(true);
    setLoading(false);
  };

  if (magicLinkSent) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4">
        <div className="glass rounded-2xl p-8 max-w-sm w-full text-center">
          <Mail className="h-12 w-12 text-neon mx-auto mb-4" />
          <h2 className="font-display text-xl font-bold mb-2">Check your email</h2>
          <p className="text-sm text-text-muted">
            We sent a magic link to <strong className="text-text">{email}</strong>
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4">
      <div className="glass rounded-2xl p-8 max-w-sm w-full">
        <div className="text-center mb-6">
          <div className="w-12 h-12 rounded-xl bg-neon/10 flex items-center justify-center mx-auto mb-3">
            <Scan className="h-7 w-7 text-neon" />
          </div>
          <h1 className="font-display text-2xl font-bold">Sign in to NATEFIT</h1>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
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
            placeholder="Your password"
          />

          {error && <p className="text-xs text-danger">{error}</p>}

          <Button type="submit" loading={loading} className="w-full">
            Sign In
          </Button>
        </form>

        <div className="relative my-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-white/10" />
          </div>
          <div className="relative flex justify-center">
            <span className="px-2 text-xs text-text-dim bg-bg">or</span>
          </div>
        </div>

        <Button variant="secondary" onClick={handleMagicLink} className="w-full" loading={loading}>
          <Mail className="h-4 w-4 mr-2" />
          Magic Link
        </Button>

        <p className="text-xs text-text-dim text-center mt-6">
          Don&apos;t have an account?{' '}
          <Link href="/signup" className="text-neon hover:underline">
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
