import 'server-only';
import { supabaseServer } from '@/lib/supabase/server';

export type Viewer = {
  id: string;
  email: string;
  role: 'customer' | 'staff' | 'admin';
  account_id: string | null;
  full_name: string | null;
  phone: string | null;
};

/** The signed-in person and their profile, or null. */
export async function getViewer(): Promise<Viewer | null> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from('profiles')
    .select('id, email, role, account_id, full_name, phone')
    .eq('id', user.id)
    .single();

  return (data as Viewer) ?? null;
}

export const isStaff = (v: Viewer | null) => v?.role === 'staff' || v?.role === 'admin';

/**
 * Whether someone is authenticated, regardless of whether they have a profile.
 *
 * Google sign-in will authenticate anyone with a Google account, but access
 * needs a profile row that only staff create. This separates "not signed in"
 * from "signed in but not set up", so the second case gets an explanation
 * instead of being bounced back to a login form it has already passed.
 */
export async function hasSession(): Promise<boolean> {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return Boolean(user);
}
