-- =============================================================================
-- TourHome AI — 002: subscriptions & free-trial enforcement
-- Run this in Supabase → SQL Editor if you already applied schema.sql.
-- Fresh installs get it automatically (it is included at the end of schema.sql).
-- Idempotent.
-- =============================================================================

do $$ begin
  create type plan_id as enum ('trial', 'm1', 'm3', 'm12');
exception when duplicate_object then null; end $$;

alter table public.users add column if not exists plan             plan_id     not null default 'trial';
alter table public.users add column if not exists plan_expires_at  timestamptz;
alter table public.users add column if not exists trial_used       boolean     not null default false;
alter table public.users add column if not exists plan_note        text;
alter table public.users add column if not exists trial_property_id uuid;

create index if not exists users_plan_expires_idx on public.users(plan_expires_at);

-- -----------------------------------------------------------------------------
-- Agents must not be able to grant themselves a subscription.
-- RLS lets them UPDATE their own row, so billing columns are frozen here.
-- pg_trigger_depth() > 1 means the write came from another trigger (ours).
-- -----------------------------------------------------------------------------
create or replace function public.protect_billing_columns()
returns trigger language plpgsql as $$
begin
  -- Trusted billing code sets `tourhome.billing_ok` for the duration of its
  -- transaction; everything else (including the agent's own profile update)
  -- has the billing columns frozen.
  if coalesce(current_setting('tourhome.billing_ok', true), '') <> '1'
     and auth.role() is distinct from 'service_role' then
    new.plan            := old.plan;
    new.plan_expires_at := old.plan_expires_at;
    new.trial_used      := old.trial_used;
    new.plan_note       := old.plan_note;
    new.trial_property_id := old.trial_property_id;
  end if;
  return new;
end $$;

drop trigger if exists users_protect_billing on public.users;
create trigger users_protect_billing before update on public.users
  for each row execute function public.protect_billing_columns();

-- -----------------------------------------------------------------------------
-- Is the agent allowed to publish right now?
-- -----------------------------------------------------------------------------
create or replace function public.can_publish(p_agent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when u.plan_expires_at is not null and u.plan_expires_at > now() then true
    when u.trial_used then false
    else true
  end
  from public.users u where u.id = p_agent;
$$;

grant execute on function public.can_publish(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Enforce it at the database level, so the rule cannot be bypassed by
-- calling the REST API directly.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_publish_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_expires timestamptz;
  v_trial_used boolean;
  v_trial_property uuid;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;                                    -- already live, just editing
  end if;

  select plan_expires_at, trial_used, trial_property_id
    into v_expires, v_trial_used, v_trial_property
  from public.users where id = new.agent_id;

  if v_expires is not null and v_expires > now() then
    return new;                                    -- active subscription
  end if;

  if v_trial_used then
    -- the one trial listing may be unpublished and published again freely
    if v_trial_property is not null and v_trial_property = new.id then
      return new;
    end if;
    raise exception 'TOURHOME_TRIAL_USED'
      using hint = 'Үнэгүй туршилт дууссан. Багц идэвхжүүлнэ үү.';
  end if;

  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set trial_used = true, trial_property_id = new.id
   where id = new.agent_id;
  return new;
end $$;

drop trigger if exists properties_publish_quota on public.properties;
create trigger properties_publish_quota before insert or update on public.properties
  for each row execute function public.enforce_publish_quota();

-- -----------------------------------------------------------------------------
-- Admin helper — activate a paid plan after a bank transfer is confirmed.
--   select public.activate_plan('agent@example.mn', 'm3');
-- Runs as service_role from the SQL Editor.
-- -----------------------------------------------------------------------------
create or replace function public.activate_plan(p_email text, p_plan plan_id, p_note text default null)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_months int := case p_plan when 'm1' then 1 when 'm3' then 3 when 'm12' then 12 else 0 end;
  v_id uuid;
  v_from timestamptz;
  v_until timestamptz;
begin
  if v_months = 0 then raise exception 'plan must be m1, m3 or m12'; end if;

  select id, greatest(coalesce(plan_expires_at, now()), now()) into v_id, v_from
  from public.users where lower(email) = lower(p_email);

  if v_id is null then raise exception 'no user with email %', p_email; end if;

  v_until := v_from + (v_months || ' months')::interval;

  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set plan = p_plan, plan_expires_at = v_until, plan_note = coalesce(p_note, plan_note)
   where id = v_id;

  return v_until;
end $$;

revoke execute on function public.activate_plan(text, plan_id, text) from anon, authenticated;
