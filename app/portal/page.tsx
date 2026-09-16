import { redirect } from 'next/navigation';
import { supabaseServer } from '@/lib/supabase/server';
import { getViewer, isStaff, hasSession } from '@/lib/auth';
import Portal from './Portal';
import { title } from '@/app/_prototype/portal/meta';
import '@/app/_prototype/portal/page.css';

export const metadata = { title };

/**
 * Everything the portal shows, read as the signed-in user so RLS is what
 * decides what comes back - not a filter written here.
 */
export default async function Page() {
  const viewer = await getViewer();
  if (!viewer) redirect((await hasSession()) ? '/no-access' : '/login?next=/portal');
  if (!viewer.account_id) redirect(isStaff(viewer) ? '/admin' : '/no-access');

  const supabase = await supabaseServer();

  const [accountRes, entitiesRes, reportsRes, recipientsRes, invoicesRes] = await Promise.all([
    supabase
      .from('accounts')
      .select('id, name, plan, status, protected_since, next_check_on, renewal_on, stripe_customer_id')
      .eq('id', viewer.account_id)
      .single(),
    supabase
      .from('entities')
      .select('id, legal_name, protected_since, entity_names(id, name, status)')
      .eq('account_id', viewer.account_id)
      .order('protected_since'),
    supabase
      .from('reports')
      .select('id, period, is_baseline, summary, platforms_checked, records_found, sent_at, storage_path')
      .eq('account_id', viewer.account_id)
      .order('period', { ascending: false }),
    supabase
      .from('report_recipients')
      .select('id, name, email')
      .eq('account_id', viewer.account_id)
      .order('created_at'),
    supabase
      .from('invoices')
      .select('id, number, description, amount_cents, status, hosted_invoice_url, pdf_url, issued_on')
      .eq('account_id', viewer.account_id)
      .order('issued_on', { ascending: false }),
  ]);

  if (!accountRes.data) redirect('/login?error=no-account');

  return (
    <div className="pg-portal">
      <Portal
        viewer={viewer}
        account={accountRes.data}
        entities={entitiesRes.data ?? []}
        reports={reportsRes.data ?? []}
        recipients={recipientsRes.data ?? []}
        invoices={invoicesRes.data ?? []}
      />
    </div>
  );
}
