import { NextResponse } from 'next/server';
import { supabaseAdmin, isSupabaseConfigured } from '@/lib/supabase/admin';
import { str, isEmail } from '@/lib/validate';

/** "Send a message" on /contact. */
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) return NextResponse.json({ error: 'Bad request' }, { status: 400 });
  if (str(body.website)) return NextResponse.json({ ok: true });

  const name = str(body.name, 120);
  const email = str(body.email, 200).toLowerCase();
  const message = str(body.message, 5000);

  if (!name || !isEmail(email) || !message) {
    return NextResponse.json({ error: 'Please check the highlighted fields.' }, { status: 422 });
  }

  if (!isSupabaseConfigured()) {
    console.warn('[contact] Supabase not configured; message dropped:', { name, email });
    return NextResponse.json({ ok: true, stored: false });
  }

  const { error } = await supabaseAdmin()
    .from('contact_messages')
    .insert({ name, email, message, company: str(body.company, 200) || null });

  if (error) {
    console.error('[contact] insert failed:', error.message);
    return NextResponse.json({ error: 'Something went wrong on our end.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true, stored: true });
}
