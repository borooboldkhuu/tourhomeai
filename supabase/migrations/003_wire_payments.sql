-- =============================================================================
-- TourHome AI — 003: wire.mn payments
-- Requires 002_billing.sql.
-- =============================================================================

do $$ begin
  create type payment_status as enum ('pending', 'paid', 'failed', 'canceled', 'expired');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- Every checkout attempt. Written only by the server (service_role).
-- -----------------------------------------------------------------------------
create table if not exists public.payments (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null references public.users(id) on delete cascade,
  plan               plan_id not null,
  amount_minor       bigint not null,                -- 1 ₮ = 100 minor units
  currency           text not null default 'MNT',
  status             payment_status not null default 'pending',
  provider           text not null default 'wire',
  payment_intent_id  text unique,                    -- pi_…
  checkout_session_id text,                          -- cs_…
  checkout_url       text,
  livemode           boolean not null default false,
  paid_at            timestamptz,
  months_granted     smallint,
  plan_expires_at    timestamptz,
  raw                jsonb,
  created_at         timestamptz not null default now()
);

create index if not exists payments_user_idx    on public.payments(user_id, created_at desc);
create index if not exists payments_status_idx  on public.payments(status);

-- -----------------------------------------------------------------------------
-- Webhook de-duplication: Wire may deliver the same event more than once.
-- -----------------------------------------------------------------------------
create table if not exists public.webhook_events (
  id           text primary key,                     -- Wire event id
  type         text not null,
  received_at  timestamptz not null default now(),
  payload      jsonb
);

alter table public.payments       enable row level security;
alter table public.webhook_events enable row level security;

drop policy if exists "payments owner read" on public.payments;
create policy "payments owner read" on public.payments
  for select using (auth.uid() = user_id);
-- no insert/update/delete policies: only the service_role key may write.

-- -----------------------------------------------------------------------------
-- Credit a successful payment. Safe to call repeatedly with the same intent.
-- Returns the new expiry, or null if the payment was already applied.
-- -----------------------------------------------------------------------------
create or replace function public.apply_payment(p_payment_intent text)
returns timestamptz language plpgsql security definer set search_path = public as $$
declare
  v_payment public.payments;
  v_months int;
  v_from timestamptz;
  v_until timestamptz;
begin
  select * into v_payment from public.payments where payment_intent_id = p_payment_intent for update;
  if v_payment.id is null then
    raise exception 'unknown payment_intent %', p_payment_intent;
  end if;
  if v_payment.status = 'paid' then
    return null;                                   -- already credited
  end if;

  v_months := case v_payment.plan
                when 'm1' then 1 when 'm3' then 3 when 'm12' then 12 else 0 end;
  if v_months = 0 then raise exception 'payment % has no billable plan', p_payment_intent; end if;

  select greatest(coalesce(plan_expires_at, now()), now()) into v_from
  from public.users where id = v_payment.user_id;

  v_until := v_from + (v_months || ' months')::interval;

  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set plan = v_payment.plan,
         plan_expires_at = v_until,
         plan_note = 'wire:' || p_payment_intent
   where id = v_payment.user_id;

  update public.payments
     set status = 'paid', paid_at = now(), months_granted = v_months, plan_expires_at = v_until
   where id = v_payment.id;

  return v_until;
end $$;

revoke execute on function public.apply_payment(text) from anon, authenticated;

-- -----------------------------------------------------------------------------
-- OPTIONAL — hard expiry.
-- By default an expired plan only blocks NEW listings; already published tours
-- keep working so customer links never break. Call this to also take them
-- offline, e.g. from pg_cron:
--   select cron.schedule('tourhome-expire', '0 3 * * *',
--                        $$select public.deactivate_expired()$$);
-- -----------------------------------------------------------------------------
create or replace function public.deactivate_expired(p_grace_days int default 3)
returns integer language plpgsql security definer set search_path = public as $$
declare v_count int;
begin
  with expired as (
    select id from public.users
     where plan_expires_at is not null
       and plan_expires_at < now() - make_interval(days => p_grace_days)
  )
  update public.properties p
     set status = 'archived'
   where p.status = 'published'
     and p.agent_id in (select id from expired);

  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.deactivate_expired(int) from anon, authenticated;
