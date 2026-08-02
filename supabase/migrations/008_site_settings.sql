-- =============================================================================
-- TourHome AI — 008: editable site settings
-- Lets an administrator swap the 360° sample shown on the landing page without
-- touching the code. Idempotent.
-- =============================================================================

create table if not exists public.site_settings (
  key        text primary key,
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.users(id) on delete set null
);

alter table public.site_settings enable row level security;

-- Anyone may read: the landing page is public.
drop policy if exists "settings public read" on public.site_settings;
create policy "settings public read" on public.site_settings
  for select using (true);

-- Writes happen through the service-role key on the server only — no policy.

drop trigger if exists site_settings_updated_at on public.site_settings;
create trigger site_settings_updated_at before update on public.site_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Bucket for marketing assets. Public to read, administrators to write.
-- -----------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit)
values ('site-assets', 'site-assets', true, 83886080)   -- 80 MB
on conflict (id) do nothing;

drop policy if exists "site assets public read" on storage.objects;
create policy "site assets public read" on storage.objects
  for select using (bucket_id = 'site-assets');

drop policy if exists "site assets admin write" on storage.objects;
create policy "site assets admin write" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "site assets admin update" on storage.objects;
create policy "site assets admin update" on storage.objects
  for update to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());

drop policy if exists "site assets admin delete" on storage.objects;
create policy "site assets admin delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'site-assets' and public.is_admin());
