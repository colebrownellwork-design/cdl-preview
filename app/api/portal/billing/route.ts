import { NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getViewer } from '@/lib/auth';

/**
 * "Update card" in the portal. Hands the customer to Stripe's own billing
 * portal so card details never touch this site.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!viewer?.account_id) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (!isStripeConfigured()) {
    return NextResponse.json({ error: 'Stripe is not configured' }, { status: 503 });
  }

  const { data: account } = await supabaseAdmin()
    .from('accounts')
    .select('stripe_customer_id')
    .eq('id', viewer.account_id)
    .single();

  if (!account?.stripe_customer_id) {
    return NextResponse.json({ error: 'No billing record yet' }, { status: 409 });
  }

  const session = await stripe().billingPortal.sessions.create({
    customer: account.stripe_customer_id,
    return_url: `${new URL(request.url).origin}/portal`,
  });

  return NextResponse.json({ url: session.url });
}
