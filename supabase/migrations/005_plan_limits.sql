-- =============================================================================
-- TourHome AI — 005: how many tours each plan may publish at once
--   trial → 1     Starter → 5     Professional → 20     Business → unlimited
-- Requires 002–004. Idempotent.
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
