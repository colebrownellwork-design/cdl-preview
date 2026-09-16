import { NextResponse } from 'next/server';
import type Stripe from 'stripe';
import { stripe, isStripeConfigured } from '@/lib/stripe';
import { supabaseAdmin } from '@/lib/supabase/admin';

/**
 * Stripe -> database. This is the only thing that may mark an account paid, so
 * a forged request must not reach the handler: every event is signature-checked
 * against STRIPE_WEBHOOK_SECRET before it is read.
 */
export async function POST(request: Request) {
  if (!isStripeConfigured() || !process.env.STRIPE_WEBHOOK_SECRET) {
    return NextResponse.json({ error: 'Stripe not configured' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'No signature' }, { status: 400 });

  // The raw body is required for signature verification - parsed JSON will not
  // verify, because the bytes have changed.
  const raw = await request.text();

  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(raw, signature, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('[stripe] signature verification failed:', (err as Error).message);
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
  }

  const db = supabaseAdmin();

  switch (event.type) {
    case 'invoice.paid':
    case 'invoice.payment_failed':
    case 'invoice.finalized': {
      const invoice = event.data.object as Stripe.Invoice;
      await recordInvoice(db, invoice);

      if (event.type === 'invoice.paid') {
        await markAccountProtected(db, invoice);
      }
      break;
    }

    case 'customer.subscription.updated':
    case 'customer.subscription.created': {
      const sub = event.data.object as Stripe.Subscription;
      const renewal = (sub as unknown as { current_period_end?: number }).current_period_end;
      await db
        .from('accounts')
        .update({
          stripe_subscription_id: sub.id,
          renewal_on: renewal ? new Date(renewal * 1000).toISOString().slice(0, 10) : null,
        })
        .eq('stripe_customer_id', String(sub.customer));
      break;
    }

    case 'customer.subscription.deleted': {
      const sub = event.data.object as Stripe.Subscription;
      await db
        .from('accounts')
        .update({ status: 'lapsed' })
        .eq('stripe_customer_id', String(sub.customer));
      break;
    }
  }

  return NextResponse.json({ received: true });
}

type Db = ReturnType<typeof supabaseAdmin>;

async function accountIdFor(db: Db, customerId: string | null) {
  if (!customerId) return null;
  const { data } = await db
    .from('accounts')
    .select('id')
    .eq('stripe_customer_id', customerId)
    .maybeSingle();
  return data?.id ?? null;
}

async function recordInvoice(db: Db, invoice: Stripe.Invoice) {
  const accountId = await accountIdFor(db, invoice.customer ? String(invoice.customer) : null);
  if (!accountId) {
    console.warn('[stripe] invoice for unknown customer:', invoice.customer);
    return;
  }

  await db.from('invoices').upsert(
    {
      account_id: accountId,
      stripe_invoice_id: invoice.id!,
      number: invoice.number,
      description: invoice.description,
      amount_cents: invoice.amount_due,
      currency: invoice.currency,
      status: invoice.status ?? 'open',
      hosted_invoice_url: invoice.hosted_invoice_url,
      pdf_url: invoice.invoice_pdf,
      issued_on: invoice.created ? new Date(invoice.created * 1000).toISOString().slice(0, 10) : null,
      paid_at: invoice.status === 'paid' ? new Date().toISOString() : null,
    },
    { onConflict: 'stripe_invoice_id' },
  );
}

/** A paid invoice is what turns a quote into a protected account. */
async function markAccountProtected(db: Db, invoice: Stripe.Invoice) {
  const accountId = await accountIdFor(db, invoice.customer ? String(invoice.customer) : null);
  if (!accountId) return;

  const { data: account } = await db
    .from('accounts')
    .select('protected_since')
    .eq('id', accountId)
    .single();

  const today = new Date().toISOString().slice(0, 10);
  await db
    .from('accounts')
    .update({
      status: 'protected',
      // Preserve the original date on a renewal - only a first payment sets it.
      protected_since: account?.protected_since ?? today,
    })
    .eq('id', accountId);

  if (invoice.id) {
    await db
      .from('quotes')
      .update({ status: 'accepted', accepted_at: new Date().toISOString() })
      .eq('stripe_invoice_id', invoice.id);
  }
}
