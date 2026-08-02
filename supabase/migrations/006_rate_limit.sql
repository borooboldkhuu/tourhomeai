-- =============================================================================
-- TourHome AI — 006: rate limiting for the public endpoints
-- Lead forms and the analytics beacon are open to the internet, so they need a
-- cheap, dependency-free throttle. Counters live in Postgres and expire.
-- Idempotent.
-- =============================================================================

create table if not exists public.rate_limits (
  key          text primary key,
  count        integer not null default 0,
  window_start timestamptz not null default now()
);

alter table public.rate_limits enable row level security;
-- no policies: only the service_role key may touch this table

-- -----------------------------------------------------------------------------
-- Returns true when the caller is still under the limit, false when throttled.
--   select public.check_rate_limit('lead:1.2.3.4', 5, 3600);
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_key text,
  p_limit integer,
  p_window_seconds integer
)
returns boolean language plpgsql security definer set search_path = public as $$
declare
  v_count integer;
  v_start timestamptz;
begin
  select count, window_start into v_count, v_start
  from public.rate_limits where key = p_key for update;

  if v_start is null then
    insert into public.rate_limits (key, count, window_start) values (p_key, 1, now())
    on conflict (key) do update set count = public.rate_limits.count + 1;
    return true;
  end if;

  if v_start < now() - make_interval(secs => p_window_seconds) then
    update public.rate_limits set count = 1, window_start = now() where key = p_key;
    return true;
  end if;

  if v_count >= p_limit then
    return false;
  end if;

  update public.rate_limits set count = count + 1 where key = p_key;
  return true;
end $$;

revoke execute on function public.check_rate_limit(text, integer, integer) from anon, authenticated;

-- Housekeeping: drop counters nobody has touched for a day.
create or replace function public.purge_rate_limits()
returns integer language plpgsql security definer set search_path = public as $$
declare v_count integer;
begin
  delete from public.rate_limits where window_start < now() - interval '1 day';
  get diagnostics v_count = row_count;
  return v_count;
end $$;

revoke execute on function public.purge_rate_limits() from anon, authenticated;
