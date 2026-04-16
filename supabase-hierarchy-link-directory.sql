-- Hierarchy link directory migration.
--
-- What this does:
-- 1. Drops the old table named "Team Leader1" if it exists.
-- 2. Creates a normalized directory table for leaders and their roles.
-- 3. Seeds optional display names used by the parent-plan dropdown logic already
--    installed by supabase-schema.sql.
--
-- Important:
-- - Core hierarchy-link logic now lives in supabase-schema.sql.
-- - The dropdown still requires:
--   a) the parent user to exist in auth.users
--   b) the parent account to be verified and approved
--   c) a saved parent plan in public.plans
-- - This table is used as a display directory layered on top of the user profile records.
--
-- Run this AFTER supabase-schema.sql.

drop table if exists public."Team Leader1" cascade;

create table if not exists public.hierarchy_link_directory (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  display_name text not null,
  role_type text not null check (role_type in ('leader', 'squad', 'platoon', 'o1')),
  active boolean not null default true,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists hierarchy_link_directory_email_role_idx
  on public.hierarchy_link_directory (lower(email), role_type);

drop trigger if exists hierarchy_link_directory_set_updated_at on public.hierarchy_link_directory;
create trigger hierarchy_link_directory_set_updated_at
before update on public.hierarchy_link_directory
for each row
execute function public.set_updated_at();

insert into public.hierarchy_link_directory (email, display_name, role_type, active, notes)
values
  ('erikajay0330@yahoo.com', 'Japson', 'leader', true, 'Example Team Leader for hierarchy link'),
  ('squad@example.com', 'Squad One Leader', 'squad', true, 'Dummy squad leader'),
  ('platoon@example.com', 'Platoon Alpha Leader', 'platoon', true, 'Dummy platoon leader'),
  ('o1@example.com', 'Davao O1 Lead', 'o1', true, 'Dummy O1 leader')
on conflict do nothing;
