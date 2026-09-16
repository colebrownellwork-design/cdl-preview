# Customs Data Lock — website

The live site, built from the design prototype in [`prototype/`](prototype/).
Next.js 15 (App Router, TypeScript) · Supabase (Postgres, Auth, RLS) · Stripe.

## How the prototype becomes the site

`prototype/` holds the original 12 self-contained HTML pages, unchanged. They are
the design source of truth and should keep being edited there.

Those pages were never meant to share a document: 87 of their CSS selectors
conflict (`:root`, `body`, `.pill`, `.topbar`, `.hero`) and all three keyframe
names are reused with different bodies. So `npm run extract` rewrites each page
into assets that can coexist:

- every selector prefixed with that page's own `.pg-<slug>` wrapper
- `:root` / `html` / `body` rules folded onto that wrapper
- keyframes renamed per page
- asset paths and internal links rewritten to app URLs
- Geist repointed at the self-hosted `next/font` variables

Output is generated and git-ignored (`app/_prototype/`, `public/_prototype/`).
`npm run build` runs it first, so a prototype edit reaches the site by rebuilding.

Marketing pages render that extracted markup and script **verbatim** — the design
is the deliverable, and rewriting it into components would quietly change it.
Login, the customer portal and the admin console are real React instead, built
against the same design, because they read and write real data.

### Wiring the forms without touching the design

The prototype validates its own forms and signals success the same way each time:
it adds the class `sent` to the form's card. `public/form-bridge.js` watches for
that and posts the form, so the prototype's JavaScript is untouched and its
validation is reused rather than duplicated. A failed post removes `sent` again
and shows an error, so a submission can never look accepted when it was not.

## Running it

```
npm install
cp .env.example .env.local   # then fill in the keys
npm run dev                  # http://localhost:4200
```

The app runs without any keys set — form posts log to the server console and
report `stored: false` instead of crashing.

## Environment

Edit `.env.local` from a terminal, not a GUI editor. A stale TextEdit buffer
silently overwrote it once and reverted a rotated key, which then got pushed to
production. Note also that TextEdit saves plain text as `.env.txt`.

| Variable | Needed for |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | everything |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | browser auth + portal reads (public, safe to expose) |
| `SUPABASE_SECRET_KEY` | form posts, Stripe webhook. **Bypasses RLS — server only, never commit** |
| `STRIPE_SECRET_KEY` | raising and sending invoices |
| `STRIPE_WEBHOOK_SECRET` | verifying webhook signatures |

## Database

Migrations are in `supabase/migrations/`, applied in order:

1. `0001_init.sql` — 14 tables modelled on what the portal and admin screens show
2. `0002_rls.sql` — Row Level Security
3. `0003_seed_platforms.sql` — the monitored platform list

**Access model.** The public site never talks to the database directly: form
posts go through server routes holding the secret key, so `anon` has no read or
write access anywhere and a leaked publishable key is worthless on its own.
Signed-in customers read only their own account through RLS; staff see
everything. A customer may add a name to their own entity and change report
recipients, and nothing else.

## Payments

Stripe runs **quote-first**, matching the pricing page: there is no public
checkout because the site quotes rather than sells.

1. Someone submits the Free Exposure Check → `exposure_checks`
2. Staff work the queue and save a quote → `quotes`
3. `POST /api/admin/quotes/send` raises a Stripe invoice for the agreed amount
   and emails it
4. `invoice.paid` webhook flips the account to `protected` and mirrors the
   invoice into `invoices`, which is what the portal's billing table reads
5. "Update card" opens Stripe's own billing portal, so card details never touch
   this site

Amounts come from the agreed quote, not a price list, so there are no fixed
Stripe Prices to keep in sync.

## Accounts and data

Sign-in is one form for everyone; the profile's role decides whether you land on
`/portal` or `/admin`. There is no self-signup - customers are created by staff.

| Script | What it does |
|---|---|
| `scripts/set-password.sh <email>` | Sets a sign-in password, prompted, never echoed |
| `scripts/clear-demo-data.mjs <admin-email>` | Wipes demo/test rows, keeping one admin |
| `scripts/seed-demo.mjs` | Rebuilds the demo customer and staff logins, for local work |
| `scripts/add-platforms.mjs "Name" ...` | Adds monitored platforms |

**Do not run `seed-demo.mjs` against the live project** - it creates sign-ins
with known passwords. It is for local development only.

## Still to do

- [x] ~~Rotate `SUPABASE_SECRET_KEY`~~ done; the leaked key is revoked
- [x] ~~Stripe~~ live in test mode: restricted key, webhook endpoint, and the
      full path verified - quote -> invoice -> paid -> account protected.
      Switch to live keys when ready, and repoint the webhook at the real domain
- [ ] Clear the test data before go-live: the seeded accounts, both demo users,
      and Harbor & Vine Foods (created by the end-to-end invoice test)
- [ ] Monthly monitoring runs are not generated - `monitoring_runs` needs a
      scheduled job creating one row per account per month
- [ ] Report PDFs are not generated or stored, so the portal shows a download
      control only where a `storage_path` exists (currently nowhere)
- [ ] The `platforms` table holds only the eight the prototype names. "18
      platforms" is a public simplification: the real list mixes trade
      platforms, the same data resold under other organizational structures,
      and viewpoints on how a company appears. Complete it with
      `scripts/add-platforms.mjs` when the real checklist is confirmed
- [ ] The admin's pricing calculator (an internal estimating tool in the
      prototype, no backend behind it) has not been ported
- [ ] No email notification when a lead arrives; the admin queue is the only
      place a new exposure check shows up
- [ ] No rate limiting on the public form routes beyond the honeypot
- [ ] No PayPal checkout in this app - see Payments above
- [ ] Deploy: Vercel project, env vars, Stripe webhook endpoint, then DNS at
      GoDaddy (do not touch MX)
