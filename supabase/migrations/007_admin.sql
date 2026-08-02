-- =============================================================================
-- TourHome AI — 007: admin role
--
-- SECURITY FIX: `users` RLS lets an agent update their own profile row, which
-- until now included `role`. Anyone could have promoted themselves to admin.
-- The column is frozen here alongside the billing columns.
-- Idempotent.
-- =============================================================================

create or replace function public.protect_billing_columns()
returns trigger language plpgsql as $$
begin
  -- Trusted billing code sets `tourhome.billing_ok` for the duration of its
  -- transaction; everything else (including the agent's own profile update)
  -- has these columns frozen.
  if coalesce(current_setting('tourhome.billing_ok', true), '') <> '1'
     and auth.role() is distinct from 'service_role' then
    new.plan              := old.plan;
    new.plan_expires_at   := old.plan_expires_at;
    new.trial_used        := old.trial_used;
    new.plan_note         := old.plan_note;
    new.trial_property_id := old.trial_property_id;
    new.trial_started_at  := old.trial_started_at;
    new.role              := old.role;   -- privilege escalation guard
  end if;
  return new;
end $$;

drop trigger if exists users_protect_billing on public.users;
create trigger users_protect_billing before update on public.users
  for each row execute function public.protect_billing_columns();

-- -----------------------------------------------------------------------------
-- Is the current session an administrator?
-- -----------------------------------------------------------------------------
create or replace function public.is_admin()
returns boolean language sql stable security definer set search_path = public as $$
  select coalesce((select role = 'admin' from public.users where id = auth.uid()), false);
$$;

grant execute on function public.is_admin() to authenticated;

-- -----------------------------------------------------------------------------
-- Admins may read everything. Writes still go through the service-role key on
-- the server, so a stolen browser token cannot mutate other people's data.
-- -----------------------------------------------------------------------------
drop policy if exists "properties admin read" on public.properties;
create policy "properties admin read" on public.properties
  for select using (public.is_admin());

drop policy if exists "leads admin read" on public.leads;
create policy "leads admin read" on public.leads
  for select using (public.is_admin());

drop policy if exists "payments admin read" on public.payments;
create policy "payments admin read" on public.payments
  for select using (public.is_admin());

drop policy if exists "analytics admin read" on public.analytics;
create policy "analytics admin read" on public.analytics
  for select using (public.is_admin());

-- -----------------------------------------------------------------------------
-- Cancel a subscription (mirror of activate_plan).
-- -----------------------------------------------------------------------------
create or replace function public.revoke_plan(p_email text)
returns void language plpgsql security definer set search_path = public as $$
begin
  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set plan = 'trial', plan_expires_at = null, plan_note = 'revoked ' || now()::date
   where lower(email) = lower(p_email);
end $$;

revoke execute on function public.revoke_plan(text) from anon, authenticated;

-- =============================================================================
-- FIRST ADMIN — run once, replacing the address with your own:
--
--   update public.users set role = 'admin' where email = 'you@example.mn';
--
-- The trigger above blocks self-promotion from the app, but the SQL Editor
-- runs as the owner, so this statement works.
-- =============================================================================
