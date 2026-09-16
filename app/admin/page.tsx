import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer, isStaff, hasSession } from '@/lib/auth';
import Admin from './Admin';
import { title } from '@/app/_prototype/admin/meta';
import '@/app/_prototype/admin/page.css';

export const metadata = { title };

/**
 * Staff console. Read as the signed-in staffer, so RLS is doing the gating -
 * the redirect below is only there to send the wrong person somewhere useful.
 */
export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect((await hasSession()) ? '/no-access' : '/login?next=/admin');
  if (!isStaff(viewer)) redirect('/portal');

  const supabase = await supabaseServer();
  const monthStart = new Date();
  monthStart.setDate(1);
  const monthStartIso = monthStart.toISOString().slice(0, 10);

  const [accountsRes, checksRes, entitiesRes, platformsRes, staffRes, runsRes, reportsRes, recipientsRes] =
    await Promise.all([
      supabase
        .from('accounts')
        .select('id, name, plan, status, protected_since, next_check_on, renewal_on, renewal_is_automatic, stripe_customer_id')
        .order('name'),
      supabase
        .from('exposure_checks')
        .select('id, company, contact_name, job_title, email, reason, reason_other, other_names, plan_hint, status, notes, account_id, submitted_at')
        .order('submitted_at', { ascending: false }),
      supabase
        .from('entities')
        .select('id, account_id, legal_name, status, protected_since, entity_names(id, name, status)'),
      supabase.from('platforms').select('id, slug, name, is_active').order('sort'),
      supabase.from('profiles').select('id, email, full_name, role').in('role', ['staff', 'admin']),
      supabase
        .from('monitoring_runs')
        .select('id, account_id, period, due_on, status, new_names_found')
        .order('due_on'),
      supabase.from('reports').select('id, sent_at').gte('period', monthStartIso),
      supabase.from('report_recipients').select('id, account_id, name, email').order('created_at'),
    ]);

  return (
    <div className="pg-admin">
      <Admin
        viewer={viewer}
        accounts={accountsRes.data ?? []}
        checks={checksRes.data ?? []}
        entities={entitiesRes.data ?? []}
        platforms={platformsRes.data ?? []}
        staff={staffRes.data ?? []}
        runs={runsRes.data ?? []}
        reportsThisMonth={reportsRes.data ?? []}
        recipients={recipientsRes.data ?? []}
      />
    </div>
  );
}
