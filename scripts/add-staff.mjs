/**
 * Gives people access to the admin console.
 *
 *   node --env-file=.env.local scripts/add-staff.mjs eric@example.com ana@example.com
 *
 * Staff see every account, contact, exposure check and invoice - there is no
 * partial view - so only add people who should see all customer data.
 *
 * Accounts are created without a password. Each person sets their own with
 * `scripts/set-password.sh <their-email>`, or uses "Email me a sign-in link" on
 * the login page. Safe to re-run: existing people are left alone.
 */
import { createClient } from '@supabase/supabase-js';

const emails = process.argv.slice(2).map((e) => e.trim().toLowerCase()).filter(Boolean);
if (!emails.length) {
  console.error('Usage: node --env-file=.env.local scripts/add-staff.mjs <email> [email...]');
  process.exit(1);
}

const bad = emails.filter((e) => !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e));
if (bad.length) {
  console.error('Not valid email addresses:', bad.join(', '));
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const { data: existing } = await db.auth.admin.listUsers();

for (const email of emails) {
  let user = existing?.users?.find((u) => u.email === email);

  if (user) {
    console.log(`exist  ${email}`);
  } else {
    const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
    if (error) {
      console.log(`FAIL   ${email}: ${error.message}`);
      continue;
    }
    user = data.user;
    console.log(`create ${email}`);
  }

  // `admin` and `staff` currently have identical access - is_staff() accepts
  // both - so this is a label until the app distinguishes them.
  const { error } = await db
    .from('profiles')
    .upsert({ id: user.id, email, role: 'admin', account_id: null }, { onConflict: 'id' });
  if (error) console.log(`  ! could not set role for ${email}: ${error.message}`);
}

const { data: staff } = await db
  .from('profiles')
  .select('email, role')
  .in('role', ['staff', 'admin'])
  .order('email');

console.log('\nWho can reach the admin console:');
for (const s of staff ?? []) console.log(`  ${s.email.padEnd(34)} ${s.role}`);
console.log('\nNobody has a password yet unless they set one:');
console.log('  bash scripts/set-password.sh <email>');
