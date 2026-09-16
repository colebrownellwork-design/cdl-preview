/**
 * Removes everything the demo seed and the end-to-end tests created, leaving a
 * clean database for real customers.
 *
 * Creates a real admin sign-in FIRST. Deleting the seeded staff user without
 * one would lock everybody out of the admin console, since there is no
 * self-signup and staff are only ever created here or in Supabase directly.
 *
 *   node --env-file=.env.local scripts/clear-demo-data.mjs <admin-email>
 *
 * Keeps: the `platforms` table, which is real configuration, not demo data.
 */
import { createClient } from '@supabase/supabase-js';

const adminEmail = process.argv[2];
if (!adminEmail || !adminEmail.includes('@')) {
  console.error('Usage: node --env-file=.env.local scripts/clear-demo-data.mjs <admin-email>');
  process.exit(1);
}

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const DEMO_USERS = ['dana@yourcompany.example', 'cole@customsdatalock.example'];
const DEMO_ACCOUNTS = [
  'Your Company LLC', 'Meridian Parts Supply', 'Blue Fern Skincare',
  'Oakhaven Furniture Imports', 'Sable Coffee Traders', 'Tidewater Marine Supply',
  'Harbor & Vine Foods',
];
const DEMO_CHECKS = [
  'Lumen Outdoor Co.', 'Castellan Apparel Group', 'Blue Fern Skincare', 'Harbor & Vine Foods',
];

// --- 1. a real admin, before anything is removed -------------------------
const { data: existing } = await db.auth.admin.listUsers();
let admin = existing?.users?.find((u) => u.email === adminEmail);

if (admin) {
  console.log(`admin user already exists: ${adminEmail}`);
} else {
  const { data, error } = await db.auth.admin.createUser({
    email: adminEmail,
    email_confirm: true, // no password yet - set it with scripts/set-password.sh
  });
  if (error) {
    console.error('could not create the admin user:', error.message);
    process.exit(1);
  }
  admin = data.user;
  console.log(`created admin user: ${adminEmail}`);
}

const { error: profileError } = await db
  .from('profiles')
  .upsert({ id: admin.id, email: adminEmail, role: 'admin', account_id: null }, { onConflict: 'id' });
if (profileError) {
  console.error('could not give them the admin role:', profileError.message);
  process.exit(1);
}
console.log('admin role granted');

// --- 2. remove the demo sign-ins ----------------------------------------
for (const email of DEMO_USERS) {
  const user = existing?.users?.find((u) => u.email === email);
  if (!user) continue;
  await db.auth.admin.deleteUser(user.id); // profile row cascades
  console.log(`removed user: ${email}`);
}

// --- 3. remove the demo records -----------------------------------------
// Accounts cascade to entities, names, reports, recipients, invoices, quotes.
const { count: accountCount } = await db
  .from('accounts')
  .delete({ count: 'exact' })
  .in('name', DEMO_ACCOUNTS);
console.log(`removed ${accountCount ?? 0} accounts (and everything under them)`);

const { count: checkCount } = await db
  .from('exposure_checks')
  .delete({ count: 'exact' })
  .in('company', DEMO_CHECKS);
console.log(`removed ${checkCount ?? 0} exposure checks`);

// --- 4. show what is left ------------------------------------------------
const tables = [
  'accounts', 'profiles', 'entities', 'entity_names', 'exposure_checks',
  'contact_messages', 'report_requests', 'quotes', 'monitoring_runs',
  'reports', 'report_recipients', 'invoices', 'platforms',
];

console.log('\nremaining rows:');
for (const t of tables) {
  const { count } = await db.from(t).select('*', { count: 'exact', head: true });
  console.log(`  ${t.padEnd(20)} ${count ?? 0}`);
}
