import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/admin';
import { str, isEmail } from '@/lib/validate';

/** "Get the report" - the Importer Exposure Report download on /contact. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (str(body.website)) return NextResponse.json({ ok: true });

  const email = str(body.email, 200).toLowerCase();
  if (!isEmail(email)) {
    return NextResponse.json({ error: 'That does not look like an email.' }, { status: 422 });
  }

  if (!isSupabaseConfigured()) {
    console.warn('[report-request] Supabase not configured; request dropped:', { email });
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabaseAdmin().from('report_requests').insert({
    email,
    name: str(body.name, 120) || null,
    company: str(body.company, 200) || null,
  });

  if (error) {
    console.error('[report-request] insert failed:', error.message);
    return NextResponse.json({ error: 'Something went wrong on our end.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
