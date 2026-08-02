-- =============================================================================
-- TourHome AI — PostgreSQL schema for Supabase
-- Run in Supabase Studio → SQL Editor (or `supabase db push`).
-- Idempotent: safe to re-run.
-- =============================================================================

create extension if not exists "pgcrypto";

-- -----------------------------------------------------------------------------
-- ENUMS
-- -----------------------------------------------------------------------------
do $$ begin
  create type user_role as enum ('agent', 'company', 'admin');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_status as enum ('draft', 'published', 'archived');
exception when duplicate_object then null; end $$;

do $$ begin
  create type property_type as enum ('apartment', 'house', 'office', 'land', 'commercial');
exception when duplicate_object then null; end $$;

do $$ begin
  create type image_kind as enum ('photo', 'panorama', 'floorplan', 'cover');
exception when duplicate_object then null; end $$;

do $$ begin
  create type lead_status as enum ('new', 'contacted', 'qualified', 'closed', 'lost');
exception when duplicate_object then null; end $$;

-- -----------------------------------------------------------------------------
-- 1. users  (public profile mirror of auth.users)
-- -----------------------------------------------------------------------------
create table if not exists public.users (
  id            uuid primary key references auth.users(id) on delete cascade,
  email         text not null,
  full_name     text,
  phone         text,
  company_name  text,
  avatar_url    text,
  bio           text,
  role          user_role not null default 'agent',
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- 2. properties
-- -----------------------------------------------------------------------------
create table if not exists public.properties (
  id             uuid primary key default gen_random_uuid(),
  agent_id       uuid not null references public.users(id) on delete cascade,
  slug           text not null unique,
  title          text not null,
  description    text,
  price          numeric(14,2) not null default 0,
  currency       text not null default 'MNT',
  location       text,
  district       text,
  city           text default 'Улаанбаатар',
  latitude       double precision,
  longitude      double precision,
  area           numeric(10,2),                 -- m²
  rooms          smallint,
  bathrooms      smallint,
  floor          smallint,
  total_floors   smallint,
  year_built     smallint,
  property_type  property_type not null default 'apartment',
  status         property_status not null default 'draft',
  cover_image_url text,
  video_url      text,
  amenities      text[] not null default '{}',
  view_count     integer not null default 0,
  published_at   timestamptz,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists properties_agent_id_idx on public.properties(agent_id);
create index if not exists properties_slug_idx     on public.properties(slug);
create index if not exists properties_status_idx   on public.properties(status);

-- -----------------------------------------------------------------------------
-- 3. property_images
-- -----------------------------------------------------------------------------
create table if not exists public.property_images (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  url          text not null,
  storage_path text not null,
  kind         image_kind not null default 'photo',
  caption      text,
  width        integer,
  height       integer,
  sort_order   smallint not null default 0,
  created_at   timestamptz not null default now()
);

create index if not exists property_images_property_id_idx on public.property_images(property_id);

-- -----------------------------------------------------------------------------
-- 4. property_tours  (one row per 360° scene / room)
-- -----------------------------------------------------------------------------
create table if not exists public.property_tours (
  id            uuid primary key default gen_random_uuid(),
  property_id   uuid not null references public.properties(id) on delete cascade,
  scene_key     text not null,                  -- pannellum scene id, e.g. "living-room"
  room_name     text not null,                  -- "Зочны өрөө"
  panorama_url  text not null,
  storage_path  text,
  preview_url   text,
  hfov          integer not null default 110,
  pitch         numeric(6,2) not null default 0,
  yaw           numeric(6,2) not null default 0,
  hotspots      jsonb not null default '[]'::jsonb,
  sort_order    smallint not null default 0,
  is_default    boolean not null default false,
  created_at    timestamptz not null default now(),
  unique (property_id, scene_key)
);

create index if not exists property_tours_property_id_idx on public.property_tours(property_id);

-- -----------------------------------------------------------------------------
-- 5. leads
-- -----------------------------------------------------------------------------
create table if not exists public.leads (
  id           uuid primary key default gen_random_uuid(),
  property_id  uuid not null references public.properties(id) on delete cascade,
  agent_id     uuid not null references public.users(id) on delete cascade,
  name         text not null,
  phone        text not null,
  email        text,
  message      text,
  status       lead_status not null default 'new',
  source       text default 'tour_page',
  created_at   timestamptz not null default now()
);

create index if not exists leads_agent_id_idx    on public.leads(agent_id);
create index if not exists leads_property_id_idx on public.leads(property_id);

-- -----------------------------------------------------------------------------
-- 6. analytics  (raw view/interaction events)
-- -----------------------------------------------------------------------------
create table if not exists public.analytics (
  id           bigserial primary key,
  property_id  uuid not null references public.properties(id) on delete cascade,
  agent_id     uuid not null references public.users(id) on delete cascade,
  event_type   text not null default 'view',    -- view | tour_open | scene_change | contact_click | share
  scene_key    text,
  referrer     text,
  country      text,
  device       text,
  session_id   text,
  created_at   timestamptz not null default now()
);

create index if not exists analytics_property_id_idx on public.analytics(property_id);
create index if not exists analytics_agent_created_idx on public.analytics(agent_id, created_at desc);

-- =============================================================================
-- TRIGGERS
-- =============================================================================

-- updated_at maintenance
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists users_updated_at on public.users;
create trigger users_updated_at before update on public.users
  for each row execute function public.set_updated_at();

drop trigger if exists properties_updated_at on public.properties;
create trigger properties_updated_at before update on public.properties
  for each row execute function public.set_updated_at();

-- auto-create profile row when a new auth user signs up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.users (id, email, full_name, phone, company_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'phone',
    new.raw_user_meta_data->>'company_name'
  )
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- keep properties.agent_id in sync with analytics/leads inserts from anon users
create or replace function public.fill_agent_id()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  select p.agent_id into new.agent_id from public.properties p where p.id = new.property_id;
  return new;
end $$;

drop trigger if exists leads_fill_agent on public.leads;
create trigger leads_fill_agent before insert on public.leads
  for each row execute function public.fill_agent_id();

drop trigger if exists analytics_fill_agent on public.analytics;
create trigger analytics_fill_agent before insert on public.analytics
  for each row execute function public.fill_agent_id();

-- atomic view counter, callable by anonymous visitors
create or replace function public.increment_property_view(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.properties
     set view_count = view_count + 1
   where slug = p_slug and status = 'published';
end $$;

grant execute on function public.increment_property_view(text) to anon, authenticated;

-- =============================================================================
-- ROW LEVEL SECURITY
-- Rule: an agent may only manage rows they own; the public may only read
-- published properties and their media.
-- =============================================================================

alter table public.users           enable row level security;
alter table public.properties      enable row level security;
alter table public.property_images enable row level security;
alter table public.property_tours  enable row level security;
alter table public.leads           enable row level security;
alter table public.analytics       enable row level security;

-- ---------- users ----------
drop policy if exists "users read own profile"     on public.users;
drop policy if exists "users read public profiles" on public.users;
drop policy if exists "users update own profile"   on public.users;
drop policy if exists "users insert own profile"   on public.users;

create policy "users read public profiles" on public.users
  for select using (true);

create policy "users insert own profile" on public.users
  for insert with check (auth.uid() = id);

create policy "users update own profile" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

-- ---------- properties ----------
drop policy if exists "properties public read published" on public.properties;
drop policy if exists "properties owner read"            on public.properties;
drop policy if exists "properties owner insert"          on public.properties;
drop policy if exists "properties owner update"          on public.properties;
drop policy if exists "properties owner delete"          on public.properties;

create policy "properties public read published" on public.properties
  for select using (status = 'published');

create policy "properties owner read" on public.properties
  for select using (auth.uid() = agent_id);

create policy "properties owner insert" on public.properties
  for insert with check (auth.uid() = agent_id);

create policy "properties owner update" on public.properties
  for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

create policy "properties owner delete" on public.properties
  for delete using (auth.uid() = agent_id);

-- ---------- property_images ----------
drop policy if exists "images public read"  on public.property_images;
drop policy if exists "images owner all"    on public.property_images;

create policy "images public read" on public.property_images
  for select using (
    exists (select 1 from public.properties p
            where p.id = property_id and (p.status = 'published' or p.agent_id = auth.uid()))
  );

create policy "images owner all" on public.property_images
  for all using (
    exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  );

-- ---------- property_tours ----------
drop policy if exists "tours public read" on public.property_tours;
drop policy if exists "tours owner all"   on public.property_tours;

create policy "tours public read" on public.property_tours
  for select using (
    exists (select 1 from public.properties p
            where p.id = property_id and (p.status = 'published' or p.agent_id = auth.uid()))
  );

create policy "tours owner all" on public.property_tours
  for all using (
    exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  ) with check (
    exists (select 1 from public.properties p where p.id = property_id and p.agent_id = auth.uid())
  );

-- ---------- leads ----------
drop policy if exists "leads anon insert"   on public.leads;
drop policy if exists "leads owner read"    on public.leads;
drop policy if exists "leads owner update"  on public.leads;
drop policy if exists "leads owner delete"  on public.leads;

create policy "leads anon insert" on public.leads
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
  );

create policy "leads owner read" on public.leads
  for select using (auth.uid() = agent_id);

create policy "leads owner update" on public.leads
  for update using (auth.uid() = agent_id) with check (auth.uid() = agent_id);

create policy "leads owner delete" on public.leads
  for delete using (auth.uid() = agent_id);

-- ---------- analytics ----------
drop policy if exists "analytics anon insert" on public.analytics;
drop policy if exists "analytics owner read"  on public.analytics;

create policy "analytics anon insert" on public.analytics
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.properties p where p.id = property_id and p.status = 'published')
  );

create policy "analytics owner read" on public.analytics
  for select using (auth.uid() = agent_id);

-- =============================================================================
-- STORAGE BUCKETS + POLICIES
-- Object path convention:  {bucket}/{auth.uid()}/{property_id}/{filename}
-- so the first folder segment is always the owner id.
-- =============================================================================

insert into storage.buckets (id, name, public, file_size_limit)
values
  ('property-images',    'property-images',    true, 26214400),   -- 25 MB
  ('property-panoramas', 'property-panoramas', true, 52428800),   -- 50 MB
  ('property-videos',    'property-videos',    true, 209715200),  -- 200 MB
  ('avatars',            'avatars',            true, 5242880)     -- 5 MB
on conflict (id) do nothing;

drop policy if exists "public read media"    on storage.objects;
drop policy if exists "owner upload media"   on storage.objects;
drop policy if exists "owner update media"   on storage.objects;
drop policy if exists "owner delete media"   on storage.objects;

create policy "public read media" on storage.objects
  for select using (
    bucket_id in ('property-images','property-panoramas','property-videos','avatars')
  );

create policy "owner upload media" on storage.objects
  for insert to authenticated with check (
    bucket_id in ('property-images','property-panoramas','property-videos','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner update media" on storage.objects
  for update to authenticated using (
    bucket_id in ('property-images','property-panoramas','property-videos','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

create policy "owner delete media" on storage.objects
  for delete to authenticated using (
    bucket_id in ('property-images','property-panoramas','property-videos','avatars')
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- =============================================================================
-- ANALYTICS HELPER VIEW (agent dashboard)
-- =============================================================================
create or replace view public.property_stats
with (security_invoker = true) as
select
  p.id            as property_id,
  p.agent_id,
  p.title,
  p.slug,
  p.status,
  p.view_count,
  count(distinct l.id)                                          as lead_count,
  count(a.id) filter (where a.created_at > now() - interval '7 days')  as views_7d,
  count(a.id) filter (where a.created_at > now() - interval '30 days') as views_30d
from public.properties p
left join public.leads     l on l.property_id = p.id
left join public.analytics a on a.property_id = p.id and a.event_type = 'view'
group by p.id;


-- =============================================================================
-- TourHome AI — 002: subscriptions & free-trial enforcement
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


-- =============================================================================
-- TourHome AI — 003: wire.mn payments
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


-- =============================================================================
-- TourHome AI — 004: access window
-- Published tours go on hold when the agent's access window closes:
--   · paid plan  → plan_expires_at
--   · free trial → 7 days from the moment the trial listing was published
-- Nothing is deleted; publishing again resumes the same URL and QR code.
-- (included here so a fresh install is complete)
-- =============================================================================

alter table public.users add column if not exists trial_started_at timestamptz;

-- Existing trial users keep a full window starting now.
update public.users
   set trial_started_at = coalesce(trial_started_at, now())
 where trial_used and trial_started_at is null;

-- How long a free trial stays visible.
create or replace function public.trial_window()
returns interval language sql immutable as $$ select interval '7 days' $$;

-- -----------------------------------------------------------------------------
-- The moment an agent's public tours go on hold (null = never published yet).
-- -----------------------------------------------------------------------------
create or replace function public.access_until(p_agent uuid)
returns timestamptz language sql stable security definer set search_path = public as $$
  select greatest(
           coalesce(u.plan_expires_at, '-infinity'::timestamptz),
           coalesce(u.trial_started_at + public.trial_window(), '-infinity'::timestamptz)
         )
  from public.users u
  where u.id = p_agent;
$$;

-- -----------------------------------------------------------------------------
-- Are this agent's tours live right now?
-- -----------------------------------------------------------------------------
create or replace function public.has_access(p_agent uuid)
returns boolean language sql stable security definer set search_path = public as $$
  select case
    when u.plan_expires_at is not null and u.plan_expires_at > now() then true
    when u.trial_started_at is not null
         and u.trial_started_at + public.trial_window() > now() then true
    when not u.trial_used and u.plan_expires_at is null then true  -- nothing published yet
    else false
  end
  from public.users u
  where u.id = p_agent;
$$;

grant execute on function public.access_until(uuid) to anon, authenticated;
grant execute on function public.has_access(uuid)   to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Stamp the trial clock the first time the trial listing goes live.
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
    return new;
  end if;

  select plan_expires_at, trial_used, trial_property_id
    into v_expires, v_trial_used, v_trial_property
  from public.users where id = new.agent_id;

  if v_expires is not null and v_expires > now() then
    return new;
  end if;

  if v_trial_used then
    if v_trial_property is not null and v_trial_property = new.id then
      return new;
    end if;
    raise exception 'TOURHOME_TRIAL_USED'
      using hint = 'Үнэгүй туршилт дууссан. Багц идэвхжүүлнэ үү.';
  end if;

  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set trial_used = true,
         trial_property_id = new.id,
         trial_started_at = coalesce(trial_started_at, now())
   where id = new.agent_id;
  return new;
end $$;

-- -----------------------------------------------------------------------------
-- Public reads now require an open access window as well.
-- The rows are never deleted — they simply stop being visible to visitors.
-- -----------------------------------------------------------------------------
drop policy if exists "properties public read published" on public.properties;
create policy "properties public read published" on public.properties
  for select using (status = 'published' and public.has_access(agent_id));

drop policy if exists "images public read" on public.property_images;
create policy "images public read" on public.property_images
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and ((p.status = 'published' and public.has_access(p.agent_id)) or p.agent_id = auth.uid())
    )
  );

drop policy if exists "tours public read" on public.property_tours;
create policy "tours public read" on public.property_tours
  for select using (
    exists (
      select 1 from public.properties p
      where p.id = property_id
        and ((p.status = 'published' and public.has_access(p.agent_id)) or p.agent_id = auth.uid())
    )
  );

-- Leads and analytics may only be written for tours that are actually live.
drop policy if exists "leads anon insert" on public.leads;
create policy "leads anon insert" on public.leads
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.properties p
            where p.id = property_id and p.status = 'published' and public.has_access(p.agent_id))
  );

drop policy if exists "analytics anon insert" on public.analytics;
create policy "analytics anon insert" on public.analytics
  for insert to anon, authenticated
  with check (
    exists (select 1 from public.properties p
            where p.id = property_id and p.status = 'published' and public.has_access(p.agent_id))
  );

-- The view counter must respect the same rule.
create or replace function public.increment_property_view(p_slug text)
returns void language plpgsql security definer set search_path = public as $$
begin
  update public.properties p
     set view_count = view_count + 1
   where p.slug = p_slug
     and p.status = 'published'
     and public.has_access(p.agent_id);
end $$;


-- =============================================================================
-- TourHome AI — 005: how many tours each plan may publish at once
--   trial → 1     Starter → 5     Professional → 20     Business → unlimited
-- (included here so a fresh install is complete)
-- =============================================================================

create or replace function public.plan_tour_limit(p_plan plan_id)
returns integer language sql immutable as $$
  select case p_plan
    when 'm1'  then 5
    when 'm3'  then 20
    when 'm12' then null      -- unlimited
    else 1                    -- trial
  end;
$$;

grant execute on function public.plan_tour_limit(plan_id) to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Publishing rules, all enforced in the database:
--   · no active plan  → the single free trial listing only
--   · active plan     → up to plan_tour_limit() published listings at once
-- Unpublishing frees a slot; nothing is ever deleted.
-- -----------------------------------------------------------------------------
create or replace function public.enforce_publish_quota()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  v_plan plan_id;
  v_expires timestamptz;
  v_trial_used boolean;
  v_trial_property uuid;
  v_limit integer;
  v_published integer;
begin
  if new.status <> 'published' then
    return new;
  end if;
  if tg_op = 'UPDATE' and old.status = 'published' then
    return new;                                   -- already live, just editing
  end if;

  select plan, plan_expires_at, trial_used, trial_property_id
    into v_plan, v_expires, v_trial_used, v_trial_property
  from public.users where id = new.agent_id;

  -- ---- paid plan ----------------------------------------------------------
  if v_expires is not null and v_expires > now() then
    v_limit := public.plan_tour_limit(v_plan);
    if v_limit is null then
      return new;                                 -- unlimited
    end if;

    select count(*) into v_published
    from public.properties
    where agent_id = new.agent_id and status = 'published' and id <> new.id;

    if v_published >= v_limit then
      raise exception 'TOURHOME_PLAN_LIMIT'
        using hint = format('Багцын хязгаар: %s тур. Хуучин зараа нуух эсвэл багцаа ахиулна уу.', v_limit);
    end if;
    return new;
  end if;

  -- ---- free trial ---------------------------------------------------------
  if v_trial_used then
    if v_trial_property is not null and v_trial_property = new.id then
      return new;                                 -- re-publishing the trial listing
    end if;
    raise exception 'TOURHOME_TRIAL_USED'
      using hint = 'Үнэгүй туршилт дууссан. Багц идэвхжүүлнэ үү.';
  end if;

  perform set_config('tourhome.billing_ok', '1', true);
  update public.users
     set trial_used = true,
         trial_property_id = new.id,
         trial_started_at = coalesce(trial_started_at, now())
   where id = new.agent_id;
  return new;
end $$;

drop trigger if exists properties_publish_quota on public.properties;
create trigger properties_publish_quota before insert or update on public.properties
  for each row execute function public.enforce_publish_quota();

-- -----------------------------------------------------------------------------
-- Published tours currently counted against the plan limit.
-- -----------------------------------------------------------------------------
create or replace function public.published_count(p_agent uuid)
returns integer language sql stable security definer set search_path = public as $$
  select count(*)::int from public.properties
  where agent_id = p_agent and status = 'published';
$$;

grant execute on function public.published_count(uuid) to authenticated;
