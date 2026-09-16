import { NextResponse } from 'next/server';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getViewer, isStaff } from '@/lib/auth';
import { str, asPlan } from '@/lib/validate';

const PLAN_LABEL = {
  standard: 'Customs Data Lock - Standard',
  multi: 'Customs Data Lock - Multi-Entity',
  enterprise: 'Customs Data Lock - Enterprise',
} as const;

/**
 * Turns a worked exposure check into a real Stripe invoice, in one step:
 * opens the account if it does not exist yet, records the quote, then raises
 * and sends the invoice.
 *
 * The amount is whatever the staffer agreed - the pricing page quotes rather
 * than sells, so there are no fixed Stripe Prices to pick from.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!isStaff(viewer)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });
  if (!isStripeConfigured()) {
    return NextResponse.json(
      { error: 'Stripe is not configured. Add STRIPE_SECRET_KEY to send invoices.' },
      { status: 503 },
    );
  }

  const body = await request.json().catch(() => null);
  const checkId = str(body?.exposure_check_id, 64);
  const plan = asPlan(body?.plan);
  const amountCents = Math.round(Number(body?.amount_cents));
  const entities = Math.max(1, Math.round(Number(body?.entities_quoted) || 1));

  if (!checkId || !plan || !Number.isFinite(amountCents) || amountCents <= 0) {
    return NextResponse.json(
      { error: 'Need the check, a plan, and an amount above zero.' },
      { status: 400 },
    );
  }

  const db = supabaseAdmin();

  const { data: check } = await db
    .from('exposure_checks')
    .select('id, company, contact_name, email, account_id, status')
    .eq('id', checkId)
    .single();
  if (!check) return NextResponse.json({ error: 'Check not found' }, { status: 404 });
  if (check.status === 'sent') {
    return NextResponse.json({ error: 'That quote has already been sent.' }, { status: 409 });
  }

  // Open the account on first quote, and reuse it on any later one.
  let accountId = check.account_id;
  if (!accountId) {
    const { data: account, error } = await db
      .from('accounts')
      .insert({ name: check.company, plan, status: 'quote_sent' })
      .select('id')
      .single();
    if (error) {
      console.error('[quote] could not open account:', error.message);
      return NextResponse.json({ error: 'Could not open the account.' }, { status: 500 });
    }
    accountId = account.id;
  }

  // The invoice needs somewhere to go, and this is also who gets the reports.
  await db
    .from('report_recipients')
    .upsert(
      { account_id: accountId, name: check.contact_name, email: check.email },
      { onConflict: 'account_id,email' },
    );

  const { data: quote, error: quoteError } = await db
    .from('quotes')
    .insert({
      exposure_check_id: check.id,
      account_id: accountId,
      plan,
      entities_quoted: entities,
      amount_cents: amountCents,
      status: 'draft',
      valid_until: new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10),
    })
    .select('id')
    .single();
  if (quoteError) {
    console.error('[quote] could not save quote:', quoteError.message);
    return NextResponse.json({ error: 'Could not save the quote.' }, { status: 500 });
  }

  const { data: account } = await db
    .from('accounts')
    .select('id, name, stripe_customer_id')
    .eq('id', accountId)
    .single();

  const sdk = stripe();

  let customerId = account!.stripe_customer_id;
  if (!customerId) {
    const customer = await sdk.customers.create({
      name: account!.name,
      email: check.email,
      metadata: { account_id: accountId },
    });
    customerId = customer.id;
    await db.from('accounts').update({ stripe_customer_id: customerId }).eq('id', accountId);
  }

  const description =
    `${PLAN_LABEL[plan]} - 12 months` + (entities > 1 ? ` - ${entities} entities` : '');

  try {
    const invoice = await sdk.invoices.create({
      customer: customerId,
      collection_method: 'send_invoice',
      days_until_due: 30,
      description,
      metadata: { quote_id: quote.id, account_id: accountId },
    });

    await sdk.invoiceItems.create({
      customer: customerId,
      invoice: invoice.id,
      amount: amountCents,
      currency: 'usd',
      description,
    });

    await sdk.invoices.finalizeInvoice(invoice.id!);
    const sent = await sdk.invoices.sendInvoice(invoice.id!);

    await db
      .from('quotes')
      .update({ status: 'sent', sent_at: new Date().toISOString(), stripe_invoice_id: sent.id })
      .eq('id', quote.id);

    await db
      .from('exposure_checks')
      .update({ status: 'sent', account_id: accountId })
      .eq('id', check.id);

    return NextResponse.json({ ok: true, invoice_url: sent.hosted_invoice_url });
  } catch (err) {
    // The quote row survives so the staffer can retry without re-keying it.
    console.error('[quote] Stripe rejected the invoice:', (err as Error).message);
    return NextResponse.json({ error: `Stripe: ${(err as Error).message}` }, { status: 502 });
  }
}
