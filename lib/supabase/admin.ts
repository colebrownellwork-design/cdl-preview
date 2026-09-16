import 'server-only';
import { createClient } from '@supabase/supabase-js';

/**
 * Server-side client holding the secret key. It bypasses Row Level Security
 * entirely, so it must never be imported into anything that reaches the
 * browser - the `server-only` import above turns that mistake into a build
 * error rather than a data leak.
 *
 * Used for the public site's form posts (so `anon` needs no write access at
 * all) and for Stripe webhooks, which act with no user session.
 */
export function supabaseAdmin() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      'Supabase is not configured: set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SECRET_KEY in .env.local',
    );
  }

  return createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

/** Whether the secret key is present, so routes can degrade instead of crashing. */
export const isSupabaseConfigured = () =>
  Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SECRET_KEY);
