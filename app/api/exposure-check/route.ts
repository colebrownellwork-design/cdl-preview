import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/admin';
import { str, isEmail, asPlan } from '@/lib/validate';

/**
 * The Free Exposure Check - the front door of the funnel. Lands in
 * `exposure_checks`, which is the queue the admin console works from.
 */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });

  // The form carries a hidden `website` field no person can see or fill.
  // Answer bots exactly as we answer a real submission, so they learn nothing.
  if (str(body.website)) return NextResponse.json({ ok: true });

  const company = str(body.company, 200);
  const contact_name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();

  if (!company || !contact_name || !isEmail(email)) {
    return NextResponse.json({ error: 'Please check the highlighted fields.' }, { status: 422 });
  }

  if (!isSupabaseConfigured()) {
    console.warn('[exposure-check] Supabase not configured; submission dropped:', {
      company,
      email,
    });
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabaseAdmin()
    .from('exposure_checks')
    .insert({
      company,
      contact_name,
      email,
      job_title: str(body.title, 120) || null,
      reason: str(body.reason, 60) || null,
      reason_other: str(body.reason_other, 500) || null,
      other_names: str(body.names, 2000) || null,
      plan_hint: asPlan(str(body.plan)),
      source_path: str(body.source_path, 200) || null,
    });

  if (error) {
    console.error('[exposure-check] insert failed:', error.message);
    return NextResponse.json({ error: 'Something went wrong on our end.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
