/**
 * Development seed: recreates the prototype's "Your Company LLC" as real rows,
 * so the portal can be built and checked against actual data.
 *
 * Not for production. Run with:
 *   node --env-file=.env.local scripts/seed-demo.mjs
 */
import { createClient } from '@supabase/supabase-js';

const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false },
});

const DEMO_EMAIL = 'dana@yourcompany.example';
const DEMO_PASSWORD = 'cdl-demo-portal';

const ENTITIES = [
  {
    legal_name: 'Your Company LLC',
    protected_since: '2025-03-12',
    names: ['Your Company LLC', 'YOUR COMPANY', 'Your Co. LLC', 'Your Company Inc', 'YOUR COMPANY L.L.C'],
    pending: ['Your Company Corp'],
  },
  {
    legal_name: 'Your Brand Inc',
    protected_since: '2025-03-12',
    names: ['Your Brand Inc', 'Your Brand', 'YOUR BRAND INC'],
    pending: [],
  },
  {
    legal_name: 'Your Trading Co.',
    protected_since: '2025-06-04',
    names: ['Your Trading Co.', 'Your Trading', 'Your Trading Company', 'YOUR TRADING CO'],
    pending: [],
  },
];

// Sent dates and notes lifted from the prototype's report list.
const REPORTS = [
  ['2025-04-01', '2025-04-07', 'first check · all records gone from 11 platforms'],
  ['2025-05-01', '2025-05-05', 'nothing new'],
  ['2025-06-01', '2025-06-09', 'Your Trading Co. added'],
  ['2025-07-01', '2025-07-07', 'nothing new'],
  ['2025-08-01', '2025-08-04', 'nothing new'],
  ['2025-09-01', '2025-09-08', 'nothing new'],
  ['2025-10-01', '2025-10-06', 'nothing new'],
  ['2025-11-01', '2025-11-03', 'nothing new'],
  ['2025-12-01', '2025-12-08', 'nothing new'],
  ['2026-01-01', '2026-01-06', 'nothing new'],
  ['2026-02-01', '2026-02-03', 'nothing new'],
  ['2026-03-01', '2026-03-04', 'nothing new'],
  ['2026-04-01', '2026-04-06', 'nothing new'],
  ['2026-05-01', '2026-05-05', '1 new name found and added'],
  ['2026-06-01', '2026-06-03', 'nothing new'],
  ['2026-07-01', '2026-07-06', 'nothing new'],
  ['2026-08-01', '2026-08-04', 'nothing new'],
  ['2026-09-01', '2026-09-07', 'nothing new'],
];

const die = (label, error) => {
  if (error) {
    console.error(`✗ ${label}:`, error.message);
    process.exit(1);
  }
};

// Start clean so the seed can be re-run.
const { data: existing } = await db.from('accounts').select('id').eq('name', 'Your Company LLC');
for (const { id } of existing ?? []) {
  await db.from('accounts').delete().eq('id', id); // cascades to everything below
}

const { data: account, error: accountError } = await db
  .from('accounts')
  .insert({
    name: 'Your Company LLC',
    plan: 'multi',
    status: 'protected',
    protected_since: '2025-03-12',
    next_check_on: '2026-10-05',
    renewal_on: '2027-03-12',
    renewal_is_automatic: true,
  })
  .select('id')
  .single();
die('account', accountError);
console.log('✓ account', account.id);

for (const entity of ENTITIES) {
  const { data: row, error } = await db
    .from('entities')
    .insert({
      account_id: account.id,
      legal_name: entity.legal_name,
      status: 'protected',
      protected_since: entity.protected_since,
    })
    .select('id')
    .single();
  die(`entity ${entity.legal_name}`, error);

  const names = [
    ...entity.names.map((name) => ({ entity_id: row.id, name, status: 'protected' })),
    ...entity.pending.map((name) => ({ entity_id: row.id, name, status: 'being_added' })),
  ];
  die('names', (await db.from('entity_names').insert(names)).error);
}
console.log('✓ entities and names');

die(
  'recipients',
  (
    await db.from('report_recipients').insert([
      { account_id: account.id, name: 'Dana Reyes', email: DEMO_EMAIL },
      { account_id: account.id, name: 'Marcus Oyelaran', email: 'marcus@yourcompany.example' },
    ])
  ).error,
);

die(
  'reports',
  (
    await db.from('reports').insert([
      {
        account_id: account.id,
        period: '2025-02-01',
        is_baseline: true,
        summary: '11 of 18 platforms showed 614 records',
        platforms_checked: 18,
        records_found: 614,
        sent_at: '2025-02-18T12:00:00Z',
      },
      // `is_baseline` is spelled out because a batch insert with mixed keys
      // writes NULL for the missing ones rather than falling back to the default.
      ...REPORTS.map(([period, sent, summary]) => ({
        account_id: account.id,
        period,
        is_baseline: false,
        summary,
        platforms_checked: 18,
        records_found: 0,
        sent_at: `${sent}T12:00:00Z`,
      })),
    ])
  ).error,
);
console.log('✓ recipients and reports');

die(
  'invoices',
  (
    await db.from('invoices').insert([
      { account_id: account.id, stripe_invoice_id: 'in_seed_2026_031', number: 'INV-2026-031', description: '12 months', amount_cents: 249000, status: 'paid', issued_on: '2026-03-12', paid_at: '2026-03-12T12:00:00Z' },
      { account_id: account.id, stripe_invoice_id: 'in_seed_2025_118', number: 'INV-2025-118', description: 'added Your Trading Co.', amount_cents: 59000, status: 'paid', issued_on: '2025-06-04', paid_at: '2025-06-04T12:00:00Z' },
      { account_id: account.id, stripe_invoice_id: 'in_seed_2025_044', number: 'INV-2025-044', description: '12 months', amount_cents: 249000, status: 'paid', issued_on: '2025-03-12', paid_at: '2025-03-12T12:00:00Z' },
    ])
  ).error,
);

// A sign-in for the demo customer.
const { data: users } = await db.auth.admin.listUsers();
const prior = users?.users?.find((u) => u.email === DEMO_EMAIL);
if (prior) await db.auth.admin.deleteUser(prior.id);

const { data: created, error: userError } = await db.auth.admin.createUser({
  email: DEMO_EMAIL,
  password: DEMO_PASSWORD,
  email_confirm: true,
});
die('auth user', userError);

die(
  'profile',
  (
    await db.from('profiles').insert({
      id: created.user.id,
      account_id: account.id,
      email: DEMO_EMAIL,
      full_name: 'Dana Reyes',
      phone: '(317) 555-0142',
      role: 'customer',
    })
  ).error,
);

console.log('✓ invoices and sign-in');
console.log(`\nPortal login:  ${DEMO_EMAIL}  /  ${DEMO_PASSWORD}`);

// --------------------------------------------------------------- staff ----
// A staff sign-in plus a few more accounts and checks, so the admin console
// has a realistic queue to work against.
const STAFF_EMAIL = 'cole@customsdatalock.example';
const STAFF_PASSWORD = 'cdl-demo-admin';

const { data: allUsers } = await db.auth.admin.listUsers();
const priorStaff = allUsers?.users?.find((u) => u.email === STAFF_EMAIL);
if (priorStaff) await db.auth.admin.deleteUser(priorStaff.id);

const { data: staff, error: staffError } = await db.auth.admin.createUser({
  email: STAFF_EMAIL,
  password: STAFF_PASSWORD,
  email_confirm: true,
});
die('staff user', staffError);

die(
  'staff profile',
  (
    await db.from('profiles').insert({
      id: staff.user.id,
      email: STAFF_EMAIL,
      full_name: 'Cole Brownell',
      role: 'admin',
    })
  ).error,
);

const OTHERS = [
  ['Meridian Parts Supply', 'standard', 'protected', '2025-11-30', '2026-10-02'],
  ['Blue Fern Skincare', 'standard', 'quote_sent', null, null],
  ['Oakhaven Furniture Imports', 'enterprise', 'protected', '2027-01-15', '2026-10-01'],
  ['Sable Coffee Traders', 'standard', 'renewal_due', '2026-12-08', '2026-10-06'],
  ['Tidewater Marine Supply', 'multi', 'protected', '2027-02-22', '2026-10-03'],
];
// Neither `accounts.name` nor `exposure_checks.company` is unique - deliberately,
// since two real customers could share a name - so reset by deleting first.
await db.from('accounts').delete().in('name', OTHERS.map((o) => o[0]));

for (const [name, plan, status, renewal_on, next_check_on] of OTHERS) {
  const { data: a, error } = await db
    .from('accounts')
    .insert({ name, plan, status, renewal_on, next_check_on })
    .select('id')
    .single();
  die(`account ${name}`, error);
  await db.from('entities').insert({ account_id: a.id, legal_name: name, status: 'protected' });
}

const CHECK_COMPANIES = ['Lumen Outdoor Co.', 'Castellan Apparel Group', 'Blue Fern Skincare'];
await db.from('exposure_checks').delete().in('company', CHECK_COMPANIES);

die(
  'checks',
  (
    await db.from('exposure_checks').insert(
      [
        { company: 'Lumen Outdoor Co.', contact_name: 'Tom Reilly', job_title: 'Founder', email: 'tom@lumenoutdoor.example', reason: 'curious', status: 'new' },
        { company: 'Castellan Apparel Group', contact_name: 'J. Whitfield', job_title: 'Procurement', email: 'jw@castellan.example', reason: 'negotiation', status: 'in_review' },
        { company: 'Blue Fern Skincare', contact_name: 'Ana Duarte', job_title: 'CEO', email: 'ana@bluefern.example', reason: 'competitor', status: 'in_review' },
      ],
    )
  ).error,
);

console.log(`Admin login:   ${STAFF_EMAIL}  /  ${STAFF_PASSWORD}`);
