-- =============================================================================
-- TourHome AI — 004: access window
-- Published tours go on hold when the agent's access window closes:
--   · paid plan  → plan_expires_at
--   · free trial → 7 days from the moment the trial listing was published
-- Nothing is deleted; publishing again resumes the same URL and QR code.
-- Requires 002 and 003. Idempotent.
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
