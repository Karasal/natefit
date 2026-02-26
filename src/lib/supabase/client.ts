'use client';

import { createBrowserClient } from '@supabase/ssr';

export function createClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!url || !key) {
    // Return a dummy client that won't crash during SSG/build
    // Real client only works when env vars are configured
    return createBrowserClient(
      'https://placeholder.supabase.co',
      'placeholder-key'
    );
  }

  return createBrowserClient(url, key);
}
