-- Row Level Security.
--
-- Two shapes of access, and nothing else:
--   staff/admin  - everything
--   customer     - only rows belonging to their own account, mostly read-only
--
-- `anon` is granted nothing anywhere. The public site's forms post to server
-- routes that hold the secret key, so the browser never needs write access and
-- a leaked publishable key cannot be used to read or insert anything.

-- Both helpers are SECURITY DEFINER so they can read `profiles` without being
-- filtered by the very policies that call them, which would otherwise recurse.
create or replace function public.current_account_id() returns uuid
  language sql stable security definer set search_path = public as $$
  select account_id from profiles where id = auth.uid()
$$;

create or replace function public.is_staff() returns boolean
  language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role in ('staff', 'admin')
  )
$$;

revoke all on function public.current_account_id() from public, anon;
revoke all on function public.is_staff() from public, anon;
grant execute on function public.current_account_id() to authenticated;
grant execute on function public.is_staff() to authenticated;

alter table accounts           enable row level security;
alter table profiles           enable row level security;
alter table entities           enable row level security;
alter table entity_names       enable row level security;
alter table exposure_checks    enable row level security;
alter table contact_messages   enable row level security;
alter table report_requests    enable row level security;
alter table quotes             enable row level security;
alter table platforms          enable row level security;
alter table monitoring_runs    enable row level security;
alter table monitoring_checks  enable row level security;
alter table reports            enable row level security;
alter table report_recipients  enable row level security;
alter table invoices           enable row level security;

-- ------------------------------------------------------------ staff: all ----
do $$
declare t text;
begin
  foreach t in array array[
    'accounts', 'profiles', 'entities', 'entity_names', 'exposure_checks',
    'contact_messages', 'report_requests', 'quotes', 'platforms',
    'monitoring_runs', 'monitoring_checks', 'reports', 'report_recipients',
    'invoices'
  ] loop
    execute format(
      'create policy staff_all on %I for all to authenticated
         using (public.is_staff()) with check (public.is_staff())', t);
  end loop;
end $$;

-- -------------------------------------------------------- customer: read ----
create policy own_profile on profiles
  for select to authenticated using (id = auth.uid());

create policy own_account on accounts
  for select to authenticated using (id = public.current_account_id());

-- Tables hanging directly off an account.
do $$
declare t text;
begin
  foreach t in array array[
    'entities', 'quotes', 'monitoring_runs', 'reports', 'report_recipients', 'invoices'
  ] loop
    execute format(
      'create policy own_account_rows on %I for select to authenticated
         using (account_id = public.current_account_id())', t);
  end loop;
end $$;

-- Name variations reach the account through their entity.
create policy own_entity_names on entity_names
  for select to authenticated using (
    exists (
      select 1 from entities e
      where e.id = entity_names.entity_id
        and e.account_id = public.current_account_id()
    )
  );

-- The platform list is not customer data; any signed-in user may read it.
create policy platforms_readable on platforms
  for select to authenticated using (true);

-- ------------------------------------------------------- customer: write ----
-- The portal lets a customer add a name to one of their entities and withdraw
-- one they added. New names always start as 'being_added' - a customer cannot
-- declare their own name protected, only staff can after filing it.
create policy add_own_entity_name on entity_names
  for insert to authenticated with check (
    status = 'being_added'
    and exists (
      select 1 from entities e
      where e.id = entity_names.entity_id
        and e.account_id = public.current_account_id()
    )
  );

create policy withdraw_own_entity_name on entity_names
  for delete to authenticated using (
    status = 'being_added'
    and exists (
      select 1 from entities e
      where e.id = entity_names.entity_id
        and e.account_id = public.current_account_id()
    )
  );

-- "Change who gets the reports".
create policy manage_own_recipients on report_recipients
  for insert to authenticated
  with check (account_id = public.current_account_id());

create policy remove_own_recipients on report_recipients
  for delete to authenticated
  using (account_id = public.current_account_id());

create policy update_own_recipients on report_recipients
  for update to authenticated
  using (account_id = public.current_account_id())
  with check (account_id = public.current_account_id());

-- A customer may edit their own name and phone, nothing else on the profile.
create policy update_own_profile on profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- WITH CHECK cannot see the row as it was, so on its own the policy above would
-- let a customer point their own `account_id` at somebody else's account and
-- read it, or promote themselves to staff. Pin the identity columns instead.
create or replace function public.guard_profile_self_update() returns trigger
  language plpgsql security definer set search_path = public as $$
begin
  if public.is_staff() then
    return new;
  end if;
  if new.account_id is distinct from old.account_id
     or new.role is distinct from old.role
     or new.email is distinct from old.email then
    raise exception 'profile: account, role and email are not self-editable';
  end if;
  return new;
end $$;

create trigger profiles_guard_self_update
  before update on profiles
  for each row execute function public.guard_profile_self_update();
