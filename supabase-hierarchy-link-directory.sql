-- Hierarchy link directory migration.
--
-- What this does:
-- 1. Drops the old table named "Team Leader1" if it exists.
-- 2. Creates a normalized directory table for leaders and their roles.
-- 3. Updates list_potential_parent_plans(...) so the hierarchy-link dropdown
--    uses the directory table for display names when a matching email exists.
--
-- Important:
-- - This does NOT replace the existing plans-based hierarchy logic.
-- - The dropdown still requires:
--   a) the parent user to exist in auth.users
--   b) the correct user_team_memberships chain
--   c) a saved parent plan in public.plans
-- - This table is used as a display directory layered on top of that logic.
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

create or replace function public.list_potential_parent_plans(child_role_type text)
returns table (
  id uuid,
  role_type text,
  full_name text,
  status text,
  updated_at timestamptz,
  created_at timestamptz,
  parent_plan_id uuid,
  owner_role text
)
language sql
stable
security definer
set search_path = public
as $$
  select distinct
    p.id,
    p.role_type,
    coalesce(directory.display_name, p.full_name) as full_name,
    p.status,
    p.updated_at,
    p.created_at,
    p.parent_plan_id,
    p.owner_role
  from public.plans p
  left join auth.users auth_user
    on auth_user.id = p.user_id
  left join public.hierarchy_link_directory directory
    on lower(directory.email) = lower(auth_user.email)
   and directory.role_type = p.role_type
   and directory.active = true
  where auth.uid() is not null
    and p.role_type = public.expected_parent_role(child_role_type)
    and public.current_user_can_link_to_parent(p.user_id, child_role_type)
  order by p.updated_at desc;
$$;

grant execute on function public.list_potential_parent_plans(text) to authenticated;
