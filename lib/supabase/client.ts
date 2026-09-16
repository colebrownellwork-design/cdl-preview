'use client';
import { createBrowserClient } from '@supabase/ssr';

/** Browser client. Publishable key only - every read it makes is gated by RLS. */
export function supabaseBrowser() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
  );
}
