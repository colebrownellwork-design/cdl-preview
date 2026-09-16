-- Customs Data Lock - initial schema
--
-- Modelled directly on what the prototype's portal and admin screens show, so
-- the tables match the product rather than a guess at it:
--   portal : names we protect, monthly reports, recipients, billing, invoices
--   admin  : exposure check queue, accounts, monitoring calendar, renewals
--
-- Access model: the public website never talks to the database directly. Form
-- posts go through server routes holding the secret key, so anon has no write
-- surface at all. Signed-in customers read their own account through RLS with
-- the publishable key; staff see everything.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------- enums ----
create type account_status as enum ('lead', 'quote_sent', 'protected', 'renewal_due', 'lapsed');
create type plan_tier as enum ('standard', 'multi', 'enterprise');
create type entity_status as enum ('pending', 'protected', 'withdrawn');
create type name_status as enum ('being_added', 'protected', 'withdrawn');
create type check_status as enum ('new', 'in_review', 'sent');
create type quote_status as enum ('draft', 'sent', 'accepted', 'declined', 'expired');
create type run_status as enum ('scheduled', 'in_progress', 'done');
create type user_role as enum ('customer', 'staff', 'admin');

-- ------------------------------------------------------------- accounts ----
create table accounts (
  id                     uuid primary key default gen_random_uuid(),
  name                   text not null,
  plan                   plan_tier,
  status                 account_status not null default 'lead',
  protected_since        date,
  next_check_on          date,
  renewal_on             date,
  -- Renewals are "automatic, card on file" unless a human has to step in.
  renewal_is_automatic   boolean not null default true,
  stripe_customer_id     text unique,
  stripe_subscription_id text unique,
  notes                  text,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);
create index accounts_status_idx on accounts (status);
create index accounts_renewal_idx on accounts (renewal_on) where renewal_on is not null;

-- People who can sign in. One row per auth user; customers carry an account.
create table profiles (
  id         uuid primary key references auth.users on delete cascade,
  account_id uuid references accounts on delete cascade,
  email      text not null,
  full_name  text,
  phone      text,
  role       user_role not null default 'customer',
  created_at timestamptz not null default now(),
  -- A customer without an account cannot see anything; staff never carry one.
  constraint customer_has_account check (role <> 'customer' or account_id is not null)
);
create index profiles_account_idx on profiles (account_id);

-- --------------------------------------------------- entities and names ----
create table entities (
  id              uuid primary key default gen_random_uuid(),
  account_id      uuid not null references accounts on delete cascade,
  legal_name      text not null,
  status          entity_status not null default 'pending',
  protected_since date,
  created_at      timestamptz not null default now()
);
create index entities_account_idx on entities (account_id);

-- The name variations a forwarder might file under: "YOUR COMPANY", "Your Co. LLC".
create table entity_names (
  id         uuid primary key default gen_random_uuid(),
  entity_id  uuid not null references entities on delete cascade,
  name       text not null,
  status     name_status not null default 'being_added',
  -- Set when a monthly check turned up a spelling nobody had filed yet.
  found_by_run_id uuid,
  created_at timestamptz not null default now(),
  unique (entity_id, name)
);
create index entity_names_entity_idx on entity_names (entity_id);

-- ------------------------------------------------- inbound from the site ----
-- The Free Exposure Check. This is the front door of the whole funnel.
create table exposure_checks (
  id             uuid primary key default gen_random_uuid(),
  company        text not null,
  contact_name   text not null,
  job_title      text,
  email          text not null,
  reason         text,
  reason_other   text,
  other_names    text,
  -- `?plan=` carried over from the pricing funnel, if they came that way.
  plan_hint      plan_tier,
  status         check_status not null default 'new',
  account_id     uuid references accounts on delete set null,
  assigned_to    uuid references profiles on delete set null,
  notes          text,
  source_path    text,
  submitted_at   timestamptz not null default now()
);
create index exposure_checks_status_idx on exposure_checks (status, submitted_at desc);

create table contact_messages (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  email        text not null,
  company      text,
  message      text not null,
  handled      boolean not null default false,
  submitted_at timestamptz not null default now()
);

-- "The Importer Exposure Report 2026" download on /contact.
create table report_requests (
  id           uuid primary key default gen_random_uuid(),
  email        text not null,
  name         text,
  company      text,
  submitted_at timestamptz not null default now()
);

-- ---------------------------------------------------------------- quotes ----
create table quotes (
  id                uuid primary key default gen_random_uuid(),
  exposure_check_id uuid references exposure_checks on delete set null,
  account_id        uuid references accounts on delete cascade,
  plan              plan_tier not null,
  entities_quoted   integer not null default 1,
  amount_cents      integer not null check (amount_cents >= 0),
  currency          text not null default 'usd',
  status            quote_status not null default 'draft',
  valid_until       date,
  sent_at           timestamptz,
  accepted_at       timestamptz,
  -- Set once the quote is turned into a real Stripe invoice.
  stripe_invoice_id text unique,
  created_at        timestamptz not null default now()
);
create index quotes_account_idx on quotes (account_id);

-- ------------------------------------------------------------ monitoring ----
-- Named "platforms" to match the site's own language. Entries are really
-- whatever a monthly check ticks off: trade platforms, resold faces of the same
-- data, and viewpoints on how a company appears in it.
create table platforms (
  id        uuid primary key default gen_random_uuid(),
  slug      text not null unique,
  name      text not null,
  is_active boolean not null default true,
  sort      integer not null default 0
);

-- One monthly sweep of an account across every active platform.
create table monitoring_runs (
  id            uuid primary key default gen_random_uuid(),
  account_id    uuid not null references accounts on delete cascade,
  period        date not null,               -- first of the month
  due_on        date not null,
  status        run_status not null default 'scheduled',
  completed_at  timestamptz,
  completed_by  uuid references profiles on delete set null,
  new_names_found integer not null default 0,
  summary       text,
  created_at    timestamptz not null default now(),
  unique (account_id, period)
);
create index monitoring_runs_due_idx on monitoring_runs (due_on) where status <> 'done';

alter table entity_names
  add constraint entity_names_found_by_run_fkey
  foreign key (found_by_run_id) references monitoring_runs on delete set null;

-- The per-platform ticks a staffer makes while working a run.
create table monitoring_checks (
  id             uuid primary key default gen_random_uuid(),
  run_id         uuid not null references monitoring_runs on delete cascade,
  platform_id    uuid not null references platforms on delete cascade,
  checked        boolean not null default false,
  records_found  integer not null default 0,
  checked_at     timestamptz,
  unique (run_id, platform_id)
);

-- ----------------------------------------------------------- the reports ----
create table reports (
  id           uuid primary key default gen_random_uuid(),
  account_id   uuid not null references accounts on delete cascade,
  run_id       uuid references monitoring_runs on delete set null,
  period       date not null,
  -- The one-off "before we started" exposure report predates any monthly run.
  is_baseline  boolean not null default false,
  summary      text,
  platforms_checked integer,
  records_found     integer,
  storage_path text,
  sent_at      timestamptz,
  created_at   timestamptz not null default now()
);
create index reports_account_idx on reports (account_id, period desc);

create table report_recipients (
  id         uuid primary key default gen_random_uuid(),
  account_id uuid not null references accounts on delete cascade,
  name       text,
  email      text not null,
  created_at timestamptz not null default now(),
  unique (account_id, email)
);

-- --------------------------------------------------------------- billing ----
-- Mirror of Stripe invoices, kept so the portal's billing table and the admin
-- renewals view can be rendered without calling Stripe on every page load.
create table invoices (
  id                 uuid primary key default gen_random_uuid(),
  account_id         uuid not null references accounts on delete cascade,
  stripe_invoice_id  text not null unique,
  number             text,
  description        text,
  amount_cents       integer not null,
  currency           text not null default 'usd',
  status             text not null,
  hosted_invoice_url text,
  pdf_url            text,
  issued_on          date,
  paid_at            timestamptz,
  created_at         timestamptz not null default now()
);
create index invoices_account_idx on invoices (account_id, issued_on desc);

-- ------------------------------------------------------- updated_at only ----
create or replace function set_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger accounts_updated_at before update on accounts
  for each row execute function set_updated_at();
