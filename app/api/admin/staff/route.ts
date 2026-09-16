import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getViewer, isStaff } from '@/lib/auth';
import { str, isEmail } from '@/lib/validate';

/**
 * Grant or remove access to the admin console.
 *
 * Creating the sign-in needs the service key, which is why this is a server
 * route rather than a direct write from the console like the rest.
 */
export async function POST(request: Request) {
  const viewer = await getViewer();
  if (!isStaff(viewer)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const body = await request.json().catch(() => null);
  const email = str(body?.email, 200).toLowerCase();
  if (!isEmail(email)) return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });

  const db = supabaseAdmin();
  const { data: list } = await db.auth.admin.listUsers();
  let user = list?.users?.find((u) => u.email === email);

  if (!user) {
    // Confirmed on creation so Google sign-in links to this account rather
    // than making a second one.
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    user = data.user;
  }

  const { error } = await db
    .from('profiles')
    .upsert({ id: user.id, email, role: 'admin', account_id: null }, { onConflict: 'id' });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true, email });
}

export async function DELETE(request: Request) {
  const viewer = await getViewer();
  if (!isStaff(viewer)) return NextResponse.json({ error: 'Not allowed' }, { status: 403 });

  const email = str(new URL(request.url).searchParams.get('email'), 200).toLowerCase();
  if (!isEmail(email)) return NextResponse.json({ error: 'That is not an email address.' }, { status: 400 });

  // Losing every admin would lock everyone out of the console for good.
  if (email === viewer!.email) {
    return NextResponse.json({ error: 'You cannot remove your own access.' }, { status: 409 });
  }

  const db = supabaseAdmin();
  const { count } = await db
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .in('role', ['staff', 'admin']);
  if ((count ?? 0) <= 1) {
    return NextResponse.json({ error: 'That is the last account with access.' }, { status: 409 });
  }

  const { data: list } = await db.auth.admin.listUsers();
  const user = list?.users?.find((u) => u.email === email);
  if (!user) return NextResponse.json({ error: 'No such person.' }, { status: 404 });

  // Deleting the sign-in cascades the profile away with it.
  const { error } = await db.auth.admin.deleteUser(user.id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ ok: true });
}
