import 'server-only';
import Stripe from 'stripe';

/**
 * Stripe is used in quote-first mode: there is no public checkout, because the
 * pricing page quotes rather than sells. Staff raise an invoice against an
 * agreed number and Stripe collects it.
 */
export function stripe() {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Stripe is not configured: set STRIPE_SECRET_KEY in .env.local');
  return new Stripe(key);
}

export const isStripeConfigured = () => Boolean(process.env.STRIPE_SECRET_KEY);
